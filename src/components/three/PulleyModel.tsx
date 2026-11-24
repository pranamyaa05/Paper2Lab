import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { solvePulley, type PulleyParams } from "@/lib/sim/pulley";
import { Part, PartLabel, glow } from "./Highlight";

const SLOPE = 4.4;
const R = 0.3;
const FLOOR = -1.6;
const SIZE_M = 0.8;
const SIZE_m = 0.7;
const S_LOW = 0.5;
const LEN2_BASE = 0.25;
/** Scales real accelerations (m/s²) into comfortable on-screen motion. */
const TIME_SCALE = 0.3;

const COLORS = {
  incline: "#f6c27f",
  blockM: "#a9c6f7",
  blockm: "#f6b3c6",
  pulley: "#9aa7bd",
  rope: "#b07a4f",
  table: "#f1e6cf",
};

export function pulleyLayout(thetaDeg: number) {
  const th = (thetaDeg * Math.PI) / 180;
  const dir = new THREE.Vector2(Math.cos(th), Math.sin(th));
  const nrm = new THREE.Vector2(-Math.sin(th), Math.cos(th));
  const top = dir.clone().multiplyScalar(SLOPE);
  const C = top.clone().add(dir.clone().multiplyScalar(0.25)).add(nrm.clone().multiplyScalar(0.4 - R));
  const P1 = C.clone().add(nrm.clone().multiplyScalar(R));
  const P2 = new THREE.Vector2(C.x + R, C.y);
  const sHigh = Math.min(SLOPE - 0.7, S_LOW + (P2.y - FLOOR - SIZE_m - 0.05 - LEN2_BASE));
  const s0 = S_LOW + (sHigh - S_LOW) * 0.35;
  return { th, dir, nrm, top, C, P1, P2, sHigh, sLow: S_LOW, s0 };
}

export interface PulleyMotion {
  s: number;
  v: number;
  pause: number;
}

function setSegment(mesh: THREE.Mesh | null, a: THREE.Vector3, b: THREE.Vector3) {
  if (!mesh) return;
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  mesh.scale.set(1, Math.max(len, 0.001), 1);
}

export function PulleyScene({
  params,
  running = true,
  resetKey = 0,
  highlight,
  onSelect,
}: {
  params: PulleyParams;
  running?: boolean;
  resetKey?: number;
  highlight: string | null;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const layout = useMemo(() => pulleyLayout(params.thetaDeg), [params.thetaDeg]);
  const result = useMemo(() => solvePulley(params), [params]);
  const motion = useRef<PulleyMotion>({ s: layout.s0, v: 0, pause: 0 });
  const blockM = useRef<THREE.Group>(null);
  const blockm = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const rope1 = useRef<THREE.Mesh>(null);
  const rope2 = useRef<THREE.Mesh>(null);

  useEffect(() => {
    motion.current = { s: layout.s0, v: 0, pause: 0 };
  }, [layout, resetKey, result.acceleration]);

  const inclineGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(layout.top.x, 0);
    shape.lineTo(layout.top.x, layout.top.y);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    g.translate(0, 0, -0.7);
    return g;
  }, [layout]);
  useEffect(() => () => inclineGeo.dispose(), [inclineGeo]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const st = motion.current;
    if (st.pause > 0) {
      st.pause -= dt;
      if (st.pause <= 0) {
        st.s = layout.s0;
        st.v = 0;
      }
    } else if (running && result.acceleration !== 0) {
      st.v += result.acceleration * TIME_SCALE * dt;
      st.s += st.v * dt;
      if (st.s >= layout.sHigh) {
        st.s = layout.sHigh;
        st.v = 0;
        st.pause = 1.1;
      } else if (st.s <= layout.sLow) {
        st.s = layout.sLow;
        st.v = 0;
        st.pause = 1.1;
      }
    }
    const { dir, nrm, P1, P2, C } = layout;
    const center = dir.clone().multiplyScalar(st.s).add(nrm.clone().multiplyScalar(SIZE_M / 2));
    blockM.current?.position.set(center.x, center.y, 0);
    const A = center.clone().add(dir.clone().multiplyScalar(SIZE_M / 2));
    setSegment(rope1.current, new THREE.Vector3(A.x, A.y, 0), new THREE.Vector3(P1.x, P1.y, 0));
    const len2 = LEN2_BASE + (st.s - layout.sLow);
    const topY = P2.y - len2;
    blockm.current?.position.set(P2.x, topY - SIZE_m / 2, 0);
    setSegment(rope2.current, new THREE.Vector3(P2.x, P2.y, 0), new THREE.Vector3(P2.x, topY, 0));
    if (wheel.current) {
      wheel.current.position.set(C.x, C.y, 0);
      wheel.current.rotation.z = -(st.s - layout.s0) / R;
    }
  });

  const is = (id: string) => highlight === id;
  const { top, C, th } = layout;
  const bracketLen = Math.hypot(C.x - top.x, C.y - top.y) + 0.35;

  return (
    <group position={[-(top.x + 0.4) / 2, 0.3, 0]}>
      {/* table */}
      <mesh position={[(top.x - 0.6) / 2, -0.08, 0]}>
        <boxGeometry args={[top.x + 0.6, 0.16, 1.9]} />
        <meshStandardMaterial color={COLORS.table} roughness={0.7} />
      </mesh>
      {[-0.45, top.x - 0.15].map((x) =>
        [-0.75, 0.75].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, (FLOOR - 0.16) / 2, z]}>
            <cylinderGeometry args={[0.06, 0.06, -FLOOR - 0.16, 12]} />
            <meshStandardMaterial color={COLORS.table} roughness={0.7} />
          </mesh>
        )),
      )}
      <mesh position={[top.x / 2, FLOOR - 0.01, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[4.2, 48]} />
        <meshStandardMaterial color="#e7f1fb" roughness={1} />
      </mesh>

      <Part id="incline" active={is("incline")} label="Inclined plane · θ" labelPosition={[top.x * 0.55, top.y * 0.25, 0.9]} onSelect={onSelect}>
        <mesh geometry={inclineGeo}>
          <meshStandardMaterial color={COLORS.incline} emissive={COLORS.incline} emissiveIntensity={glow(is("incline"))} roughness={0.55} />
        </mesh>
      </Part>

      <Part id="blockM" active={is("blockM")} label="Block M" labelPosition={null} onSelect={onSelect}>
        <group ref={blockM} rotation-z={th}>
          {is("blockM") && <PartLabel label="Block M" position={[0, 0.8, 0]} />}
          <mesh>
            <boxGeometry args={[SIZE_M, SIZE_M, SIZE_M]} />
            <meshStandardMaterial color={COLORS.blockM} emissive={COLORS.blockM} emissiveIntensity={glow(is("blockM"))} roughness={0.35} />
          </mesh>
        </group>
      </Part>

      <Part id="rope" active={is("rope")} label="String · tension T" labelPosition={[top.x - 0.8, top.y + 0.2, 0]} onSelect={onSelect}>
        <mesh ref={rope1}>
          <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
          <meshStandardMaterial color={COLORS.rope} emissive="#ffb070" emissiveIntensity={glow(is("rope"))} />
        </mesh>
        <mesh ref={rope2}>
          <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
          <meshStandardMaterial color={COLORS.rope} emissive="#ffb070" emissiveIntensity={glow(is("rope"))} />
        </mesh>
      </Part>

      <Part id="pulley" active={is("pulley")} label="Pulley" labelPosition={[C.x, C.y + 0.7, 0]} onSelect={onSelect}>
        {/* bracket */}
        <mesh position={[(top.x + C.x) / 2 - 0.08, (top.y + C.y) / 2 - 0.15, 0]} rotation-z={th + 0.55}>
          <boxGeometry args={[0.22, bracketLen, 0.16]} />
          <meshStandardMaterial color="#7d8597" roughness={0.4} metalness={0.3} />
        </mesh>
        <group ref={wheel} position={[C.x, C.y, 0]}>
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[R, R, 0.2, 32]} />
            <meshStandardMaterial color={COLORS.pulley} emissive="#bcd2ff" emissiveIntensity={glow(is("pulley"))} metalness={0.4} roughness={0.3} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation-z={(i * Math.PI) / 3} position={[0, 0, 0.11]}>
              <boxGeometry args={[R * 1.7, 0.05, 0.02]} />
              <meshStandardMaterial color="#4f5a73" />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.12]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#2c3a78" />
          </mesh>
        </group>
      </Part>

      <Part id="blockm" active={is("blockm")} label="Hanging mass m" labelPosition={null} onSelect={onSelect}>
        <group ref={blockm}>
          {is("blockm") && <PartLabel label="Hanging mass m" position={[1.1, 0, 0]} />}
          <mesh>
            <boxGeometry args={[SIZE_m, SIZE_m, SIZE_m]} />
            <meshStandardMaterial color={COLORS.blockm} emissive={COLORS.blockm} emissiveIntensity={glow(is("blockm"))} roughness={0.35} />
          </mesh>
        </group>
      </Part>
    </group>
  );
}
