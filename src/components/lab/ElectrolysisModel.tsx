import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Part, glow } from "@/components/three/Highlight";
import { cellCurrent, gasVolumes } from "@/lib/sim/electrolysis";

/** One real second shows ten seconds of electrolysis, so the tubes fill at a watchable pace. */
const TIME_SCALE = 10;
const TUBE_ML = 50;
const TUBE_R = 0.34;
const TUBE_BOTTOM = -1.2;
const TUBE_TOP = 1.4; // where the dome starts
const TUBE_H = TUBE_TOP - TUBE_BOTTOM;
const XS = { h2: -1.1, o2: 1.1 };
const WATER_TOP = -0.25;

function GasColumn({ x, mL, color, waterColor }: { x: number; mL: number; color: string; waterColor: string }) {
  const frac = Math.min(1, mL / TUBE_ML);
  const gasH = frac * TUBE_H;
  const waterH = TUBE_H - gasH;
  return (
    <group position={[x, 0, 0]}>
      {waterH > 0.001 && (
        <mesh position={[0, TUBE_BOTTOM + waterH / 2, 0]}>
          <cylinderGeometry args={[TUBE_R - 0.03, TUBE_R - 0.03, waterH, 32]} />
          <meshStandardMaterial color={waterColor} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      {gasH > 0.001 && (
        <mesh position={[0, TUBE_TOP - gasH / 2, 0]}>
          <cylinderGeometry args={[TUBE_R - 0.03, TUBE_R - 0.03, gasH, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

export function ElectrolysisModel({
  voltage,
  conc,
  resetKey,
  highlight,
  onSelect,
}: {
  voltage: number;
  conc: number;
  resetKey: number;
  highlight: string | null;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const current = cellCurrent(voltage, conc);
  const sim = useRef({ seconds: 0 });
  const [vol, setVol] = useState({ h2mL: 0, o2mL: 0, seconds: 0 });
  const bubbles = useRef<(THREE.Mesh | null)[]>([]);
  const lastUi = useRef(0);

  useEffect(() => {
    sim.current.seconds = 0;
    setVol({ h2mL: 0, o2mL: 0, seconds: 0 });
  }, [resetKey]);

  const bubbleSeeds = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ side: i % 3 === 2 ? "o2" : "h2", phase: (i * 0.618) % 1, dx: Math.sin(i * 2.7) * 0.12, dz: Math.cos(i * 1.3) * 0.12 })), []);

  useFrame((s, delta) => {
    const dt = Math.min(delta, 0.05);
    const v = gasVolumes(current, sim.current.seconds);
    if (v.h2mL < TUBE_ML) sim.current.seconds += dt * TIME_SCALE;
    if (s.clock.elapsedTime - lastUi.current > 0.1) {
      lastUi.current = s.clock.elapsedTime;
      const nv = gasVolumes(current, sim.current.seconds);
      setVol({ h2mL: Math.min(TUBE_ML, nv.h2mL), o2mL: Math.min(TUBE_ML, nv.o2mL), seconds: sim.current.seconds });
    }
    // Bubbles: speed and how many show both follow the current; hydrogen gets twice as many.
    const active = Math.min(1, current / 1.5);
    const gasTop = (mL: number) => TUBE_TOP - Math.min(1, mL / TUBE_ML) * TUBE_H;
    bubbles.current.forEach((b, i) => {
      if (!b) return;
      const seed = bubbleSeeds[i]!;
      const x = seed.side === "h2" ? XS.h2 : XS.o2;
      const top = gasTop(seed.side === "h2" ? v.h2mL : v.o2mL);
      const k = (s.clock.elapsedTime * (0.3 + active * 0.9) + seed.phase) % 1;
      const y = -1.45 + k * (top + 1.45);
      b.visible = current > 0.01 && i / bubbleSeeds.length < 0.25 + active * 0.75;
      b.position.set(x + seed.dx, y, seed.dz);
    });
  });

  const is = (id: string) => highlight === id;
  const glass = { color: "#eef7ff", transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false } as const;
  const wirePath = (x: number, term: number) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x, -1.5, 0), new THREE.Vector3(x, -1.82, 0.2), new THREE.Vector3(x * 0.7, -1.82, 1.3), new THREE.Vector3(term, -1.62, 1.55)]), 24, 0.03, 8);
  const wires = useMemo(() => [wirePath(XS.h2, -0.42), wirePath(XS.o2, 0.42)], []);
  useEffect(() => () => wires.forEach((w) => w.dispose()), [wires]);

  return (
    <group position={[0, 0.25, 0]}>
      {/* trough of electrolyte */}
      <mesh position={[0, -0.95, 0]}>
        <boxGeometry args={[3.8, 1.5, 1.6]} />
        <meshPhysicalMaterial {...glass} />
      </mesh>
      <Part id="electrolyte" active={is("electrolyte")} label={`Electrolyte · ${conc.toFixed(2)} mol/L`} labelPosition={[0, -0.1, 0.9]} onSelect={onSelect}>
        <mesh position={[0, (WATER_TOP - 1.68) / 2, 0]}>
          <boxGeometry args={[3.74, WATER_TOP + 1.68, 1.54]} />
          <meshStandardMaterial color="#9fd0f2" emissive="#9fd0f2" emissiveIntensity={glow(is("electrolyte")) * 0.5} transparent opacity={0.3 + conc * 0.15} depthWrite={false} />
        </mesh>
      </Part>

      <Part id="h2tube" active={is("h2tube")} label="Hydrogen tube" labelPosition={null} onSelect={onSelect}>
        <mesh position={[XS.h2, (TUBE_TOP + TUBE_BOTTOM) / 2, 0]}>
          <cylinderGeometry args={[TUBE_R, TUBE_R, TUBE_H, 32, 1, true]} />
          <meshPhysicalMaterial {...glass} emissive="#bfe3ff" emissiveIntensity={glow(is("h2tube"))} />
        </mesh>
        <mesh position={[XS.h2, TUBE_TOP, 0]}>
          <sphereGeometry args={[TUBE_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial {...glass} />
        </mesh>
        <GasColumn x={XS.h2} mL={vol.h2mL} color="#ffffff" waterColor="#9fd0f2" />
      </Part>
      <Part id="o2tube" active={is("o2tube")} label="Oxygen tube" labelPosition={null} onSelect={onSelect}>
        <mesh position={[XS.o2, (TUBE_TOP + TUBE_BOTTOM) / 2, 0]}>
          <cylinderGeometry args={[TUBE_R, TUBE_R, TUBE_H, 32, 1, true]} />
          <meshPhysicalMaterial {...glass} emissive="#bfe3ff" emissiveIntensity={glow(is("o2tube"))} />
        </mesh>
        <mesh position={[XS.o2, TUBE_TOP, 0]}>
          <sphereGeometry args={[TUBE_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial {...glass} />
        </mesh>
        <GasColumn x={XS.o2} mL={vol.o2mL} color="#ffe2ec" waterColor="#9fd0f2" />
      </Part>

      {/* live volume tags */}
      {[
        { x: XS.h2, label: "H₂", mL: vol.h2mL, hi: is("h2tube") },
        { x: XS.o2, label: "O₂", mL: vol.o2mL, hi: is("o2tube") },
      ].map((t) => (
        <Html key={t.label} position={[t.x, TUBE_TOP + 0.75, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
          <div className={`glass-panel whitespace-nowrap rounded-full px-3 py-1 text-center font-display text-xs font-bold text-ink ${t.hi ? "ring-2 ring-blush-deep" : ""}`}>
            {t.label} · {t.mL.toFixed(1)} mL{t.mL >= TUBE_ML ? " (full)" : ""}
          </div>
        </Html>
      ))}

      <Part id="cathode" active={is("cathode")} label="Cathode (−) · H₂" labelPosition={[XS.h2 - 0.8, -1.1, 0.5]} onSelect={onSelect}>
        <mesh position={[XS.h2, -1.05, 0]}>
          <boxGeometry args={[0.1, 0.9, 0.3]} />
          <meshStandardMaterial color="#5b6170" emissive="#8a93ad" emissiveIntensity={glow(is("cathode"))} metalness={0.6} roughness={0.3} />
        </mesh>
      </Part>
      <Part id="anode" active={is("anode")} label="Anode (+) · O₂" labelPosition={[XS.o2 + 0.8, -1.1, 0.5]} onSelect={onSelect}>
        <mesh position={[XS.o2, -1.05, 0]}>
          <boxGeometry args={[0.1, 0.9, 0.3]} />
          <meshStandardMaterial color="#5b6170" emissive="#8a93ad" emissiveIntensity={glow(is("anode"))} metalness={0.6} roughness={0.3} />
        </mesh>
      </Part>

      {Array.from({ length: bubbleSeeds.length }, (_, i) => (
        <mesh key={i} ref={(m) => void (bubbles.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      ))}

      <Part id="battery" active={is("battery")} label={`${voltage.toFixed(1)} V · ${current.toFixed(2)} A`} labelPosition={[0, -1.0, 1.8]} onSelect={onSelect}>
        {wires.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial color={i === 0 ? "#3d4566" : "#e05b5b"} />
          </mesh>
        ))}
        <group position={[0, -1.6, 1.55]} rotation-z={Math.PI / 2}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.84, 24]} />
            <meshStandardMaterial color="#3d4566" emissive="#6d79a8" emissiveIntensity={glow(is("battery"))} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.21, 0]}>
            <cylinderGeometry args={[0.205, 0.205, 0.42, 24]} />
            <meshStandardMaterial color="#f2b84b" roughness={0.4} />
          </mesh>
        </group>
      </Part>
      {/* table */}
      <mesh position={[0, -1.95, 0.5]}>
        <boxGeometry args={[5, 0.12, 3]} />
        <meshStandardMaterial color="#f1e6cf" roughness={0.8} />
      </mesh>
    </group>
  );
}
