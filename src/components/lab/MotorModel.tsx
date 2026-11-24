import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Part, PartLabel, glow } from "@/components/three/Highlight";
import { currentAt, sideForce, stepMotor } from "@/lib/sim/motor";

/** Shown in slow motion so the turning is easy to follow; the readouts use real-time values. */
const SLOW_MOTION = 0.15;
const HALF_W = 0.8; // coil half-width along x
const HALF_L = 0.75; // coil half-length along the axle (z)

function letterTexture(letter: string, bg: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 92px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Arrow({ length, color, opacity = 1 }: { length: number; color: string; opacity?: number }) {
  const L = Math.max(0.05, length);
  return (
    <group>
      <mesh position={[0, L / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, L, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, L + 0.1, 0]}>
        <coneGeometry args={[0.1, 0.22, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

export function MotorModel({
  voltage,
  field,
  turns,
  reversed,
  highlight,
  onSelect,
}: {
  voltage: number;
  field: number;
  turns: number;
  reversed: boolean;
  highlight: string | null;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const coil = useRef<THREE.Group>(null);
  const comm = useRef<THREE.Group>(null);
  const arrowA = useRef<THREE.Group>(null);
  const arrowB = useRef<THREE.Group>(null);
  const flow = useRef<(THREE.Mesh | null)[]>([]);
  const state = useRef({ phi: 0.35, omega: 0 });
  const params = useMemo(() => ({ voltage, field, turns }), [voltage, field, turns]);
  /** Live coil current: large at start-up, smaller once back-EMF builds. Read each frame by the arrows and dots. */
  const liveCurrent = useRef(0);
  const tex = useMemo(() => ({ n: letterTexture("N", "#e07a7a"), s: letterTexture("S", "#6f8fe0") }), []);
  useEffect(() => () => void (tex.n.dispose(), tex.s.dispose()), [tex]);

  const force = sideForce(params, voltage / 2);
  const wire = 0.035 + Math.min(turns, 50) * 0.0014;
  const dir: 1 | -1 = reversed ? -1 : 1;

  useFrame((s, delta) => {
    const dt = Math.min(delta, 0.05) * SLOW_MOTION;
    // a few sub-steps keep the integration smooth at high torque
    for (let i = 0; i < 4; i++) stepMotor(state.current, params, dt / 4, dir);
    const phi = state.current.phi;
    liveCurrent.current = Math.abs(currentAt(state.current.omega, phi, params, dir));
    // Arrow length follows the live force F = N·B·I·L, so it shrinks as back-EMF builds.
    const len = Math.min(1.3, 0.15 + sideForce(params, liveCurrent.current) * 0.45);
    for (const g of [arrowA.current, arrowB.current]) g?.scale.set(1, len / 0.9, 1);
    if (coil.current) coil.current.rotation.z = phi;
    if (comm.current) comm.current.rotation.z = phi;
    // The side currently on the right is pushed up (anticlockwise) or down (reversed).
    const ax = Math.cos(phi) * HALF_W;
    const ay = Math.sin(phi) * HALF_W;
    const rightIsA = ax >= 0;
    const place = (g: THREE.Group | null, x: number, y: number, up: boolean) => {
      if (!g) return;
      g.position.set(x, y, 0);
      g.rotation.z = up ? 0 : Math.PI;
      g.visible = force > 0.001;
    };
    place(arrowA.current, ax, ay, rightIsA === (dir === 1));
    place(arrowB.current, -ax, -ay, rightIsA !== (dir === 1));
    // little glowing dots show current flowing around the coil
    const t = s.clock.elapsedTime * (0.25 + Math.min(liveCurrent.current, 6) * 0.25) * dir;
    flow.current.forEach((m, i) => {
      if (!m) return;
      m.visible = liveCurrent.current > 0.05;
      const u = (((t + i / flow.current.length) % 1) + 1) % 1;
      const perim = 4 * (HALF_W + HALF_L);
      let d = u * perim;
      let x: number;
      let z: number;
      if (d < 2 * HALF_L) {
        x = HALF_W;
        z = -HALF_L + d;
      } else if ((d -= 2 * HALF_L) < 2 * HALF_W) {
        x = HALF_W - d;
        z = HALF_L;
      } else if ((d -= 2 * HALF_W) < 2 * HALF_L) {
        x = -HALF_W;
        z = HALF_L - d;
      } else {
        d -= 2 * HALF_L;
        x = -HALF_W + d;
        z = -HALF_L;
      }
      m.position.set(x, 0, z);
    });
  });

  const is = (id: string) => highlight === id;
  const copper = "#d98a4a";
  const fieldOpacity = 0.15 + field * 0.6;

  return (
    <group position={[0, 0.2, 0]}>
      {/* base */}
      <mesh position={[0, -1.55, 0.3]}>
        <boxGeometry args={[5.6, 0.14, 3.4]} />
        <meshStandardMaterial color="#f1e6cf" roughness={0.8} />
      </mesh>

      <Part id="magnets" active={is("magnets")} label="N → S magnetic field" labelPosition={[0, 1.4, 0]} onSelect={onSelect}>
        {[
          { x: -2.15, map: tex.n, color: "#e07a7a" },
          { x: 2.15, map: tex.s, color: "#6f8fe0" },
        ].map((m) => (
          <group key={m.x}>
            <mesh position={[m.x, -0.15, 0]}>
              <boxGeometry args={[0.9, 2, 1.8]} />
              <meshStandardMaterial color={m.color} emissive={m.color} emissiveIntensity={glow(is("magnets"))} roughness={0.4} />
            </mesh>
            <mesh position={[m.x, -0.15, 0.905]}>
              <planeGeometry args={[0.7, 0.7]} />
              <meshBasicMaterial map={m.map} />
            </mesh>
            <mesh position={[m.x, -1.3, 0]}>
              <boxGeometry args={[0.5, 0.4, 0.8]} />
              <meshStandardMaterial color="#9aa7bd" />
            </mesh>
          </group>
        ))}
        {/* field lines from N to S */}
        {[-0.6, 0, 0.6].map((y) =>
          [-0.55, 0.55].map((z) => (
            <group key={`${y}${z}`} position={[-1.65, y - 0.15, z]} rotation-z={-Math.PI / 2}>
              <Arrow length={3.05} color="#7c8fd6" opacity={fieldOpacity} />
            </group>
          )),
        )}
      </Part>

      {/* axle */}
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.45]}>
        <cylinderGeometry args={[0.04, 0.04, 3, 12]} />
        <meshStandardMaterial color="#8b93a6" metalness={0.5} roughness={0.3} />
      </mesh>

      <Part id="coil" active={is("coil")} label={`Coil · ${turns} turns`} labelPosition={[0, 1.05, -0.6]} onSelect={onSelect}>
        <group ref={coil}>
          {[
            { p: [HALF_W, 0, 0], r: [Math.PI / 2, 0, 0], l: 2 * HALF_L },
            { p: [-HALF_W, 0, 0], r: [Math.PI / 2, 0, 0], l: 2 * HALF_L },
            { p: [0, 0, -HALF_L], r: [0, 0, Math.PI / 2], l: 2 * HALF_W },
            { p: [0.45, 0, HALF_L], r: [0, 0, Math.PI / 2], l: 0.7 },
            { p: [-0.45, 0, HALF_L], r: [0, 0, Math.PI / 2], l: 0.7 },
          ].map((seg, i) => (
            <mesh key={i} position={seg.p as [number, number, number]} rotation={seg.r as [number, number, number]}>
              <cylinderGeometry args={[wire, wire, seg.l + wire, 12]} />
              <meshStandardMaterial color={copper} emissive="#ffb070" emissiveIntensity={glow(is("coil")) + Math.min(voltage, 12) * 0.02} metalness={0.5} roughness={0.35} />
            </mesh>
          ))}
          {/* leads to the commutator */}
          {[0.1, -0.1].map((x) => (
            <mesh key={x} position={[x * 1.6, 0, HALF_L + 0.25]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
              <meshStandardMaterial color={copper} />
            </mesh>
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={`f${i}`} ref={(m) => void (flow.current[i] = m)}>
              <sphereGeometry args={[0.055, 10, 10]} />
              <meshStandardMaterial color="#fff3a3" emissive="#ffd84a" emissiveIntensity={1.2} />
            </mesh>
          ))}
        </group>
      </Part>

      <Part id="forces" active={is("forces")} label="F = N·B·I·L on each side" labelPosition={[0, -1.1, 0.9]} onSelect={onSelect}>
        <group ref={arrowA}>
          <Arrow length={0.9} color="#ef5d8f" />
        </group>
        <group ref={arrowB}>
          <Arrow length={0.9} color="#ef5d8f" />
        </group>
      </Part>

      <Part id="commutator" active={is("commutator")} label="Split-ring commutator" labelPosition={[0, 0.65, 1.3]} onSelect={onSelect}>
        <group ref={comm} position={[0, 0, 1.3]}>
          {[0, Math.PI].map((start) => (
            <mesh key={start} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.2, 0.2, 0.32, 24, 1, true, start + 0.15, Math.PI - 0.3]} />
              <meshStandardMaterial color="#e4b85a" emissive="#ffd27a" emissiveIntensity={glow(is("commutator"))} metalness={0.6} roughness={0.25} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      </Part>

      <Part id="brushes" active={is("brushes")} label="Carbon brushes" labelPosition={[0.9, -0.2, 1.4]} onSelect={onSelect}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.33, 0, 1.3]}>
            <boxGeometry args={[0.24, 0.16, 0.2]} />
            <meshStandardMaterial color="#454a57" emissive="#8a93ad" emissiveIntensity={glow(is("brushes"))} roughness={0.7} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`w${s}`} position={[s * 0.5, -0.75, 1.55]}>
            <cylinderGeometry args={[0.025, 0.025, 1.5, 8]} />
            <meshStandardMaterial color={s < 0 ? "#e05b5b" : "#3d4566"} />
          </mesh>
        ))}
      </Part>

      <Part id="battery" active={is("battery")} label={`Battery · ${voltage.toFixed(1)} V`} labelPosition={[0, -0.75, 2.2]} onSelect={onSelect}>
        <group position={[0, -1.33, 1.6]} rotation-z={Math.PI / 2}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 1.0, 24]} />
            <meshStandardMaterial color="#3d4566" emissive="#6d79a8" emissiveIntensity={glow(is("battery"))} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.185, 0.185, 0.5, 24]} />
            <meshStandardMaterial color={reversed ? "#3d4566" : "#f2b84b"} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.185, 0.185, 0.5, 24]} />
            <meshStandardMaterial color={reversed ? "#f2b84b" : "#3d4566"} roughness={0.4} />
          </mesh>
        </group>
      </Part>
      {is("forces") && force <= 0.001 && <PartLabel label="No voltage or field: no force" position={[0, 0.9, 0]} />}
    </group>
  );
}
