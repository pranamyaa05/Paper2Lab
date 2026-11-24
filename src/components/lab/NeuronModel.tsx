import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Part, glow } from "@/components/three/Highlight";
import { mulberry } from "@/components/three/textures";
import { firesActionPotential } from "@/lib/sim/neuron";

const SOMA = new THREE.Vector3(-2.6, 0, 0);
const AXON_START = -1.6;
const AXON_END = 2.5;
const MYELIN_X = [-1.2, -0.42, 0.36, 1.14, 1.92];
const NODES = [AXON_START, -0.81, -0.03, 0.75, 1.53, 2.31, AXON_END];
const BULBS: [number, number, number][] = [
  [3.35, 0.55, 0.25],
  [3.45, 0.05, -0.35],
  [3.3, -0.5, 0.2],
  [3.15, 0.15, 0.55],
];
const POST = new THREE.Vector3(3.95, 0.62, 0.25);

const C = {
  cell: "#f6d79a",
  nucleus: "#e59a84",
  myelin: "#a8dcef",
  pulse: "#ff6fa8",
  post: "#f3c3d4",
};

function useTubes() {
  return useMemo(() => {
    const rnd = mulberry(7);
    const dendrites: THREE.TubeGeometry[] = [];
    const angles = [95, 125, 150, 175, 200, 228, 255, 60, 300];
    angles.forEach((deg) => {
      const a = (deg * Math.PI) / 180;
      const d = new THREE.Vector3(Math.cos(a), Math.sin(a), (rnd() - 0.5) * 0.8).normalize();
      const pts = [SOMA.clone().addScaledVector(d, 0.45)];
      let cur = pts[0]!.clone();
      for (let i = 0; i < 3; i++) {
        cur = cur.clone().addScaledVector(d, 0.42 + rnd() * 0.15).add(new THREE.Vector3((rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25));
        pts.push(cur);
      }
      dendrites.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.055, 6));
      // side branch
      const mid = pts[2]!;
      const side = d.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), rnd() > 0.5 ? 0.7 : -0.7);
      const b = [mid, mid.clone().addScaledVector(side, 0.35), mid.clone().addScaledVector(side, 0.65).add(new THREE.Vector3(0, 0, (rnd() - 0.5) * 0.3))];
      dendrites.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(b), 10, 0.035, 6));
    });
    const terminals = BULBS.map((b) => {
      const end = new THREE.Vector3(...b);
      const mid = new THREE.Vector3(AXON_END + 0.35, end.y * 0.4, end.z * 0.4);
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(AXON_END - 0.05, 0, 0), mid, end]), 12, 0.045, 6);
    });
    return { dendrites, terminals };
  }, []);
}

export function NeuronModel({
  myelinated,
  stimulusMv,
  fireKey,
  highlight,
  onSelect,
}: {
  myelinated: boolean;
  stimulusMv: number;
  fireKey: number;
  highlight: string | null;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const tubes = useTubes();
  useEffect(() => () => [...tubes.dendrites, ...tubes.terminals].forEach((g) => g.dispose()), [tubes]);

  const pulse = useRef<THREE.Mesh>(null);
  const somaMat = useRef<THREE.MeshStandardMaterial>(null);
  const bulbMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const transmitters = useRef<(THREE.Mesh | null)[]>([]);
  const state = useRef({ t: -1, release: -1, flicker: 0 });

  useEffect(() => {
    if (fireKey === 0) return;
    if (firesActionPotential(stimulusMv)) state.current.t = 0;
    else state.current.flicker = 0.8;
    // only react to new stimulate presses
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireKey]);

  useFrame((clock, delta) => {
    const dt = Math.min(delta, 0.05);
    const st = state.current;
    const time = clock.clock.elapsedTime;
    if (somaMat.current) {
      st.flicker = Math.max(0, st.flicker - dt);
      const base = glow(highlight === "soma");
      somaMat.current.emissiveIntensity = base + st.flicker * 0.5 * (0.5 + 0.5 * Math.sin(time * 30)) + (st.t >= 0 && st.t < 0.3 ? 0.6 : 0);
    }
    if (pulse.current) {
      if (st.t >= 0) {
        st.t += dt;
        let x: number;
        const lead = 0.35;
        if (st.t < lead) {
          x = SOMA.x + ((AXON_START - SOMA.x) * st.t) / lead;
        } else if (myelinated) {
          const hop = 0.16;
          const k = (st.t - lead) / hop;
          const i = Math.min(NODES.length - 1, Math.floor(k));
          const f = k - Math.floor(k);
          const a = NODES[i]!;
          const b = NODES[Math.min(NODES.length - 1, i + 1)]!;
          x = a + (b - a) * Math.min(1, f * 3);
        } else {
          x = AXON_START + (st.t - lead) * 1.1;
        }
        if (x >= AXON_END) {
          x = AXON_END;
          st.t = -1;
          st.release = 0;
        }
        pulse.current.visible = st.t >= 0;
        pulse.current.position.set(x, 0, 0);
        pulse.current.scale.setScalar(1 + 0.25 * Math.sin(time * 20));
      } else {
        pulse.current.visible = false;
      }
    }
    const rel = st.release;
    if (rel >= 0) st.release += dt;
    bulbMats.current.forEach((m) => {
      if (m) m.emissiveIntensity = glow(highlight === "terminal") + (rel >= 0 && rel < 0.6 ? 0.8 * (1 - rel / 0.6) : 0);
    });
    transmitters.current.forEach((m, i) => {
      if (!m) return;
      const start = new THREE.Vector3(...BULBS[0]!);
      const k = rel >= 0 ? Math.min(1, Math.max(0, (rel - i * 0.08) / 0.9)) : 0;
      m.visible = rel >= 0 && rel < 2.2;
      m.position.copy(start).lerp(POST, k).add(new THREE.Vector3(0, Math.sin(i * 2.1) * 0.12 * (1 - k), Math.cos(i * 1.7) * 0.12 * (1 - k)));
    });
    if (rel > 2.2) st.release = -1;
  });

  const is = (id: string) => highlight === id;

  return (
    <group position={[-0.5, 0, 0]}>
      <Part id="dendrite" active={is("dendrite")} label="Dendrites" labelPosition={[-3.9, 1.3, 0]} onSelect={onSelect}>
        {tubes.dendrites.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial color={C.cell} emissive={C.cell} emissiveIntensity={glow(is("dendrite"))} roughness={0.5} />
          </mesh>
        ))}
      </Part>
      <Part id="soma" active={is("soma")} label="Soma · nucleus" labelPosition={[-2.6, 0.95, 0]} onSelect={onSelect}>
        <mesh position={SOMA}>
          <sphereGeometry args={[0.62, 40, 40]} />
          <meshStandardMaterial ref={somaMat} color={C.cell} emissive="#ffd08a" transparent opacity={0.82} roughness={0.4} />
        </mesh>
        <mesh position={[-2.55, 0.05, 0.12]}>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color={C.nucleus} roughness={0.5} />
        </mesh>
      </Part>
      <Part id="hillock" active={is("hillock")} label="Axon hillock" labelPosition={[-1.85, -0.6, 0]} onSelect={onSelect}>
        <mesh position={[-1.8, 0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.09, 0.3, 0.55, 20]} />
          <meshStandardMaterial color={C.cell} emissive={C.cell} emissiveIntensity={glow(is("hillock"))} roughness={0.5} />
        </mesh>
      </Part>
      <Part id="axon" active={is("axon")} label="Axon" labelPosition={[0.4, -0.55, 0]} onSelect={onSelect}>
        <mesh position={[(AXON_START + AXON_END) / 2, 0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.085, 0.085, AXON_END - AXON_START, 16]} />
          <meshStandardMaterial color="#f1c47c" emissive={C.cell} emissiveIntensity={glow(is("axon"))} roughness={0.5} />
        </mesh>
      </Part>
      {myelinated && (
        <Part id="myelin" active={is("myelin")} label="Myelin sheath" labelPosition={[0.36, 0.6, 0]} onSelect={onSelect}>
          {MYELIN_X.map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation-z={Math.PI / 2}>
              <capsuleGeometry args={[0.2, 0.42, 8, 20]} />
              <meshStandardMaterial color={C.myelin} emissive={C.myelin} emissiveIntensity={glow(is("myelin"))} transparent opacity={0.92} roughness={0.25} />
            </mesh>
          ))}
        </Part>
      )}
      <Part id="terminal" active={is("terminal")} label="Axon terminals" labelPosition={[3.2, -0.9, 0]} onSelect={onSelect}>
        {tubes.terminals.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial color={C.cell} roughness={0.5} />
          </mesh>
        ))}
        {BULBS.map((b, i) => (
          <mesh key={i} position={b}>
            <sphereGeometry args={[0.13, 20, 20]} />
            <meshStandardMaterial ref={(m) => void (bulbMats.current[i] = m)} color={C.cell} emissive="#ffb37a" roughness={0.4} />
          </mesh>
        ))}
      </Part>
      <Part id="synapse" active={is("synapse")} label="Synapse" labelPosition={[4.05, 1.15, 0.25]} onSelect={onSelect}>
        <mesh position={POST} scale={[0.35, 0.6, 0.6]}>
          <sphereGeometry args={[0.5, 24, 24]} />
          <meshStandardMaterial color={C.post} emissive={C.post} emissiveIntensity={glow(is("synapse"))} roughness={0.5} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} ref={(m) => void (transmitters.current[i] = m)} visible={false}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial color="#5fb3d9" emissive="#5fb3d9" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </Part>
      <mesh ref={pulse} visible={false}>
        <sphereGeometry args={[0.17, 20, 20]} />
        <meshStandardMaterial color={C.pulse} emissive={C.pulse} emissiveIntensity={1.4} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}
