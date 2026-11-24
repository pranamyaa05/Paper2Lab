import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Part, glow } from "@/components/three/Highlight";
import { mulberry } from "@/components/three/textures";
import { osmosisState } from "@/lib/sim/cell";

const R = 2.2;
const SCALE: [number, number, number] = [1.25, 0.82, 1];
const NUCLEUS = new THREE.Vector3(-0.35, 0.05, 0);
const GOLGI = new THREE.Vector3(1.35, 0.35, 0.25);

const MITO: [number, number, number, number][] = [
  [-1.9, -0.55, 0.6, 0.4],
  [1.6, -0.75, -0.5, -0.6],
  [0.5, 0.95, 0.7, 1.2],
  [-1.2, 0.95, -0.8, 0.2],
  [2.0, 0.15, -0.9, 1.6],
  [-0.4, -1.05, -0.9, -0.3],
];

/** Point inside the cell ellipsoid, for vesicles travelling to the membrane. */
function membranePoint(theta: number) {
  return new THREE.Vector3(Math.cos(theta) * R * SCALE[0] * 0.95, Math.sin(theta) * 0.4, Math.sin(theta) * R * SCALE[2] * 0.95);
}

export function CellModel({
  cutaway,
  energy,
  secretion,
  outside = 300,
  highlight,
  onSelect,
}: {
  cutaway: number;
  energy: number;
  secretion: number;
  /** Osmolarity of the surrounding solution, mOsm/L. */
  outside?: number;
  highlight: string | null;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const cut = Math.min(1, Math.max(0, cutaway / 100));
  // Remove a wedge facing the camera so the inside shows.
  const phiLength = Math.PI * 2 * (1 - 0.42 * cut);
  const phiStart = -Math.PI / 2 - phiLength / 2; // centres the gap on +z, toward the viewer

  const osmo = osmosisState(outside);
  const body = useRef<THREE.Group>(null);
  const membraneMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const mitoMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const vesicles = useRef<(THREE.Mesh | null)[]>([]);

  const ribosomes = useMemo(() => {
    const rnd = mulberry(21);
    const out: [number, number, number][] = [];
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 1.6 + Math.PI * 0.2;
      const r = 1.05 + rnd() * 0.45;
      out.push([NUCLEUS.x + Math.cos(a) * r, NUCLEUS.y + (rnd() - 0.5) * 0.5, NUCLEUS.z + Math.sin(a) * r * 0.8]);
    }
    return out;
  }, []);
  const freeRibosomes = useMemo(() => {
    const rnd = mulberry(5);
    return Array.from({ length: 30 }, () => [(rnd() - 0.5) * 4.4, (rnd() - 0.5) * 2, (rnd() - 0.5) * 3] as [number, number, number]).filter(([x, y, z]) => (x / (R * SCALE[0])) ** 2 + (y / (R * SCALE[1])) ** 2 + (z / R) ** 2 < 0.7);
  }, []);

  const erGeos = useMemo(() => [0, 1, 2, 3].map((i) => new THREE.TorusGeometry(1.1 + i * 0.13, 0.045, 8, 48, Math.PI * 1.5)), []);
  const golgiGeos = useMemo(() => [0, 1, 2, 3, 4].map((i) => new THREE.TorusGeometry(0.55 - i * 0.07, 0.06, 10, 32, Math.PI * 0.9)), []);
  useEffect(() => () => [...erGeos, ...golgiGeos].forEach((g) => g.dispose()), [erGeos, golgiGeos]);

  useFrame((s, delta) => {
    const t = s.clock.elapsedTime;
    // Osmosis: the cell's size eases toward the Boyle–van 't Hoff volume (radius ∝ ∛volume).
    if (body.current) {
      const goal = Math.cbrt(Math.min(osmo.ratio, 1.6));
      const cur = body.current.scale.x;
      body.current.scale.setScalar(cur + (goal - cur) * (1 - Math.exp(-2.5 * Math.min(delta, 0.05))));
    }
    // A burst cell's membrane flickers and fades: it has torn open.
    if (membraneMat.current) membraneMat.current.opacity = osmo.lysed ? 0.12 + 0.1 * Math.abs(Math.sin(t * 7)) : 0.45;
    const e = energy / 100;
    mitoMats.current.forEach((m, i) => {
      if (!m) return;
      const pulse = 0.5 + 0.5 * Math.sin(t * (1 + e * 6) + i);
      m.emissiveIntensity = glow(highlight === "mitochondria") + e * 0.7 * pulse;
    });
    const rate = 0.05 + (secretion / 100) * 0.5;
    vesicles.current.forEach((v, i) => {
      if (!v) return;
      const k = (t * rate + i / vesicles.current.length) % 1;
      const end = membranePoint(0.4 + i * 0.9);
      v.position.copy(GOLGI).lerp(end, k);
      v.visible = secretion > 2;
      v.scale.setScalar(1 - 0.5 * k);
    });
  });

  const is = (id: string) => highlight === id;

  return (
    <group rotation={[0.2, -0.35, 0]}>
      <group ref={body}>
      <Part id="membrane" active={is("membrane")} label={`Cell membrane · ${osmo.fate}`} labelPosition={[0, R * SCALE[1] + 0.35, 0]} onSelect={onSelect}>
        <mesh scale={SCALE}>
          <sphereGeometry args={[R, 64, 40, phiStart, phiLength]} />
          <meshPhysicalMaterial ref={membraneMat} color={osmo.tonicity === "hypertonic" ? "#ffcfd8" : "#ffd9e4"} emissive="#ffc2d4" emissiveIntensity={glow(is("membrane")) * 0.6} transparent opacity={0.45} roughness={0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </Part>
      <Part id="cytoplasm" active={is("cytoplasm")} label="Cytoplasm" labelPosition={[1.6, -1.2, 0.8]} onSelect={onSelect}>
        <mesh scale={SCALE}>
          <sphereGeometry args={[R * 0.97, 48, 32, phiStart, phiLength]} />
          <meshStandardMaterial color="#fff2cf" emissive="#ffe7a8" emissiveIntensity={glow(is("cytoplasm")) * 0.4} transparent opacity={0.22} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      </Part>
      </group>

      <Part id="nucleus" active={is("nucleus")} label="Nucleus · DNA" labelPosition={[NUCLEUS.x, NUCLEUS.y + 1.0, NUCLEUS.z]} onSelect={onSelect}>
        <mesh position={NUCLEUS}>
          <sphereGeometry args={[0.72, 40, 32]} />
          <meshPhysicalMaterial color="#cdb2f0" emissive="#b796f0" emissiveIntensity={glow(is("nucleus"))} transparent opacity={0.6} roughness={0.3} depthWrite={false} />
        </mesh>
      </Part>
      <Part id="nucleolus" active={is("nucleolus")} label="Nucleolus" labelPosition={[NUCLEUS.x + 0.1, NUCLEUS.y + 0.45, NUCLEUS.z + 0.2]} onSelect={onSelect}>
        <mesh position={[NUCLEUS.x + 0.1, NUCLEUS.y, NUCLEUS.z + 0.1]}>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color="#8f5cc2" emissive="#8f5cc2" emissiveIntensity={glow(is("nucleolus"))} roughness={0.4} />
        </mesh>
      </Part>

      <Part id="er" active={is("er")} label="Rough ER" labelPosition={[NUCLEUS.x - 0.9, NUCLEUS.y - 0.6, NUCLEUS.z + 1]} onSelect={onSelect}>
        {erGeos.map((g, i) => (
          <mesh key={i} geometry={g} position={NUCLEUS} rotation={[Math.PI / 2, 0, 0.3]} scale={[1, 0.8, 1]}>
            <meshStandardMaterial color="#8fbde8" emissive="#8fbde8" emissiveIntensity={glow(is("er"))} roughness={0.4} />
          </mesh>
        ))}
      </Part>
      <Part id="ribosomes" active={is("ribosomes")} label="Ribosomes" labelPosition={[0.4, -0.5, 1.4]} onSelect={onSelect}>
        {[...ribosomes, ...freeRibosomes].map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#2f4f7a" emissive="#5d8fd6" emissiveIntensity={glow(is("ribosomes")) * 1.5} />
          </mesh>
        ))}
      </Part>

      <Part id="mitochondria" active={is("mitochondria")} label="Mitochondria · ATP" labelPosition={[MITO[0]![0], MITO[0]![1] + 0.5, MITO[0]![2]]} onSelect={onSelect}>
        {MITO.map(([x, y, z, r], i) => (
          <group key={i} position={[x, y, z]} rotation={[r, r * 0.7, Math.PI / 2 + r]}>
            <mesh>
              <capsuleGeometry args={[0.17, 0.42, 8, 20]} />
              <meshStandardMaterial ref={(m) => void (mitoMats.current[i] = m)} color="#f4a3a3" emissive="#ff8a7a" roughness={0.35} />
            </mesh>
            {[-0.15, 0, 0.15].map((dy) => (
              <mesh key={dy} position={[0, dy, 0]}>
                <torusGeometry args={[0.12, 0.018, 6, 20]} />
                <meshStandardMaterial color="#c9686d" />
              </mesh>
            ))}
          </group>
        ))}
      </Part>

      <Part id="golgi" active={is("golgi")} label="Golgi apparatus" labelPosition={[GOLGI.x, GOLGI.y + 0.75, GOLGI.z]} onSelect={onSelect}>
        {golgiGeos.map((g, i) => (
          <mesh key={i} geometry={g} position={[GOLGI.x + i * 0.06, GOLGI.y - i * 0.09, GOLGI.z]} rotation={[0, 0.3, Math.PI * 0.55]}>
            <meshStandardMaterial color="#f2b56b" emissive="#ffc27a" emissiveIntensity={glow(is("golgi"))} roughness={0.4} />
          </mesh>
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={`v${i}`} ref={(m) => void (vesicles.current[i] = m)}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color="#ffd08a" emissive="#ffb84a" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </Part>

      <Part id="lysosome" active={is("lysosome")} label="Lysosomes" labelPosition={[0.8, -0.95, -1.1]} onSelect={onSelect}>
        {[
          [0.8, -0.6, -1.1],
          [1.9, 0.6, 0.6],
          [-1.9, 0.35, -0.6],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <sphereGeometry args={[0.16, 20, 20]} />
            <meshStandardMaterial color="#a9dc96" emissive="#a9dc96" emissiveIntensity={glow(is("lysosome"))} roughness={0.35} />
          </mesh>
        ))}
      </Part>

      <Part id="centrosome" active={is("centrosome")} label="Centrosome" labelPosition={[0.75, 1.15, -0.4]} onSelect={onSelect}>
        <group position={[0.75, 0.75, -0.4]}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.06, 0.32, 12]} />
            <meshStandardMaterial color="#7d9a6d" emissive="#a6d48f" emissiveIntensity={glow(is("centrosome"))} />
          </mesh>
          <mesh rotation-z={Math.PI / 2} position={[0.12, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.32, 12]} />
            <meshStandardMaterial color="#7d9a6d" emissive="#a6d48f" emissiveIntensity={glow(is("centrosome"))} />
          </mesh>
        </group>
      </Part>
    </group>
  );
}
