import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Part, glow } from "@/components/three/Highlight";
import { phenolphthaleinColor } from "@/lib/sim/phenolphthalein";

const LIQUID_H = 1.25;
const DROPPER_TIP_Y = 2.75;

function Molecule({ active }: { active: boolean }) {
  const atoms = useMemo(() => {
    const out: { p: THREE.Vector3; kind: "C" | "O" | "H" }[] = [{ p: new THREE.Vector3(), kind: "C" }];
    const bonds: [THREE.Vector3, THREE.Vector3][] = [];
    [90, 210, 330].forEach((deg, ri) => {
      const a = (deg * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      const center = dir.clone().multiplyScalar(0.78);
      const ring: THREE.Vector3[] = [];
      for (let k = 0; k < 6; k++) {
        const t = a + Math.PI + (k * Math.PI) / 3;
        ring.push(center.clone().add(new THREE.Vector3(Math.cos(t) * 0.34, Math.sin(t) * 0.34, ri === 2 ? Math.sin(t) * 0.12 : 0)));
      }
      ring.forEach((p, k) => {
        out.push({ p, kind: "C" });
        bonds.push([p, ring[(k + 1) % 6]!]);
      });
      bonds.push([new THREE.Vector3(), ring[0]!]);
      const far = ring[3]!;
      const o = far.clone().addScaledVector(dir, 0.3);
      out.push({ p: o, kind: "O" });
      bonds.push([far, o]);
      if (ri < 2) {
        const h = o.clone().addScaledVector(dir, 0.2).add(new THREE.Vector3(0.08, 0, 0));
        out.push({ p: h, kind: "H" });
        bonds.push([o, h]);
      }
    });
    return { out, bonds };
  }, []);
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.set(Math.sin(s.clock.elapsedTime * 0.4) * 0.4, s.clock.elapsedTime * 0.5, 0);
  });
  const colors = { C: "#8a90a0", O: "#ef6f6f", H: "#ffffff" };
  return (
    <group ref={g}>
      {atoms.out.map((a, i) => (
        <mesh key={i} position={a.p}>
          <sphereGeometry args={[a.kind === "H" ? 0.06 : 0.09, 14, 14]} />
          <meshStandardMaterial color={colors[a.kind]} emissive={colors[a.kind]} emissiveIntensity={glow(active) * 0.6} roughness={0.3} />
        </mesh>
      ))}
      {atoms.bonds.map(([a, b], i) => {
        const d = new THREE.Vector3().subVectors(b, a);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        return (
          <mesh key={`b${i}`} position={a.clone().addScaledVector(d, 0.5)} quaternion={q}>
            <cylinderGeometry args={[0.025, 0.025, d.length(), 6]} />
            <meshStandardMaterial color="#c9ccd6" />
          </mesh>
        );
      })}
    </group>
  );
}

export function ChemModel({
  pH,
  dropKey,
  highlight,
  onSelect,
}: {
  pH: number;
  dropKey: number;
  highlight: string | null;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const target = phenolphthaleinColor(pH);
  const liquidMat = useRef<THREE.MeshStandardMaterial>(null);
  const topMat = useRef<THREE.MeshStandardMaterial>(null);
  const drop = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const bubbles = useRef<(THREE.Mesh | null)[]>([]);
  const st = useRef({ drop: -1, ripple: -1 });
  const goal = useMemo(() => new THREE.Color(target.color), [target.color]);

  const beakerGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.95, 0),
      new THREE.Vector2(1.0, 0.06),
      new THREE.Vector2(1.0, 2.0),
      new THREE.Vector2(1.08, 2.12),
    ];
    return new THREE.LatheGeometry(pts, 48);
  }, []);
  useEffect(() => () => beakerGeo.dispose(), [beakerGeo]);

  useEffect(() => {
    if (dropKey > 0) st.current.drop = 0;
  }, [dropKey]);

  useFrame((s, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = 1 - Math.exp(-3 * dt);
    if (liquidMat.current && topMat.current) {
      liquidMat.current.color.lerp(goal, k);
      liquidMat.current.opacity += (target.opacity - liquidMat.current.opacity) * k;
      topMat.current.color.copy(liquidMat.current.color);
      topMat.current.opacity = liquidMat.current.opacity;
      liquidMat.current.emissiveIntensity = glow(highlight === "solution") * 0.5;
    }
    const d = st.current;
    if (drop.current) {
      if (d.drop >= 0) {
        d.drop += dt;
        const y = DROPPER_TIP_Y - 0.5 * 9 * d.drop * d.drop;
        drop.current.visible = true;
        drop.current.position.set(0, y, 0);
        if (y <= LIQUID_H) {
          d.drop = -1;
          d.ripple = 0;
          drop.current.visible = false;
        }
      } else drop.current.visible = false;
    }
    if (ripple.current) {
      if (d.ripple >= 0) {
        d.ripple += dt;
        ripple.current.visible = d.ripple < 1;
        ripple.current.scale.setScalar(0.2 + d.ripple * 0.9);
        (ripple.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - d.ripple));
      } else ripple.current.visible = false;
    }
    bubbles.current.forEach((b, i) => {
      if (!b) return;
      const t = (s.clock.elapsedTime * 0.35 + i * 0.137) % 1;
      b.position.set(Math.sin(i * 2.3) * 0.6, 0.12 + t * (LIQUID_H - 0.2), Math.cos(i * 1.9) * 0.6);
    });
  });

  const is = (id: string) => highlight === id;

  return (
    <group position={[0.6, -1.3, 0]}>
      <Part id="beaker" active={is("beaker")} label="Beaker" labelPosition={[1.45, 1.8, 0]} onSelect={onSelect}>
        <mesh geometry={beakerGeo}>
          <meshPhysicalMaterial color="#e9f5ff" emissive="#bfe3ff" emissiveIntensity={glow(is("beaker")) * 0.5} transparent opacity={0.28} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {[0.5, 1.0, 1.5].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <torusGeometry args={[1.005, 0.006, 4, 48, 0.5]} />
            <meshBasicMaterial color="#7f8db0" />
          </mesh>
        ))}
      </Part>
      <Part id="solution" active={is("solution")} label={`Solution · ${target.label}`} labelPosition={[0, LIQUID_H + 0.35, 1]} onSelect={onSelect}>
        <mesh position={[0, LIQUID_H / 2 + 0.03, 0]} renderOrder={1}>
          <cylinderGeometry args={[0.93, 0.93, LIQUID_H, 48, 1, true]} />
          <meshStandardMaterial ref={liquidMat} color={target.color} emissive="#ffffff" transparent opacity={target.opacity} roughness={0.15} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, LIQUID_H + 0.03, 0]} rotation-x={-Math.PI / 2} renderOrder={2}>
          <circleGeometry args={[0.93, 48]} />
          <meshStandardMaterial ref={topMat} color={target.color} transparent opacity={target.opacity} roughness={0.1} depthWrite={false} />
        </mesh>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} ref={(m) => void (bubbles.current[i] = m)}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
        ))}
        <mesh ref={ripple} position={[0, LIQUID_H + 0.04, 0]} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.18, 0.24, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
      </Part>
      <Part id="dropper" active={is("dropper")} label="Dropper · indicator" labelPosition={[0.8, 4.3, 0]} onSelect={onSelect}>
        <group position={[0, DROPPER_TIP_Y, 0]}>
          <mesh position={[0, 0.12, 0]}>
            <coneGeometry args={[0.07, 0.25, 16]} />
            <meshPhysicalMaterial color="#cfe9ff" transparent opacity={0.6} emissive="#cfe9ff" emissiveIntensity={glow(is("dropper"))} />
          </mesh>
          <mesh position={[0, 0.27 + 0.45, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.9, 20]} />
            <meshPhysicalMaterial color="#cfe9ff" transparent opacity={0.5} roughness={0.05} emissive="#cfe9ff" emissiveIntensity={glow(is("dropper"))} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.45, 16]} />
            <meshStandardMaterial color="#8fc4ef" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 1.38, 0]} scale={[1, 1.45, 1]}>
            <sphereGeometry args={[0.2, 24, 24]} />
            <meshStandardMaterial color="#3d4566" roughness={0.6} emissive="#6d79a8" emissiveIntensity={glow(is("dropper"))} />
          </mesh>
        </group>
        <mesh ref={drop} visible={false}>
          <sphereGeometry args={[0.07, 14, 14]} />
          <meshStandardMaterial color="#8fc4ef" transparent opacity={0.9} />
        </mesh>
      </Part>
      <Part id="molecule" active={is("molecule")} label="Phenolphthalein" labelPosition={[-2.3, 4.1, 0]} onSelect={onSelect}>
        <group position={[-2.3, 3.05, 0]} scale={0.85}>
          <Molecule active={is("molecule")} />
        </group>
      </Part>
    </group>
  );
}
