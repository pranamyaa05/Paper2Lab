import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Part, glow } from "@/components/three/Highlight";
import { safeCompile } from "@/lib/expr";
import type { ParamValues, PartSpec, PrimitiveSpec } from "@/labs/types";

/** Shape geometry for one AI-described primitive, sized from its [sx, sy, sz]. */
function Shape({ p, emissive }: { p: PrimitiveSpec; emissive: number }) {
  const [sx, sy, sz] = p.size;
  const mat = <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={emissive} transparent={p.opacity < 1} opacity={p.opacity} roughness={0.4} />;
  switch (p.shape) {
    case "box":
      return (
        <mesh>
          <boxGeometry args={[sx, sy, sz]} />
          {mat}
        </mesh>
      );
    case "sphere":
      return (
        <mesh scale={[1, sy / sx || 1, sz / sx || 1]}>
          <sphereGeometry args={[sx / 2, 32, 24]} />
          {mat}
        </mesh>
      );
    case "cylinder":
      return (
        <mesh>
          <cylinderGeometry args={[sx / 2, sz / 2 || sx / 2, sy, 32]} />
          {mat}
        </mesh>
      );
    case "cone":
      return (
        <mesh>
          <coneGeometry args={[sx / 2, sy, 32]} />
          {mat}
        </mesh>
      );
    case "torus":
      return (
        <mesh>
          <torusGeometry args={[sx / 2, Math.max(0.02, sy / 2), 16, 48]} />
          {mat}
        </mesh>
      );
    case "capsule":
      return (
        <mesh>
          <capsuleGeometry args={[sx / 2, Math.max(0.01, sy - sx), 8, 20]} />
          {mat}
        </mesh>
      );
    case "arrow":
      return (
        <group>
          <mesh position={[0, sy * 0.4, 0]}>
            <cylinderGeometry args={[sx * 0.18, sx * 0.18, sy * 0.8, 12]} />
            {mat}
          </mesh>
          <mesh position={[0, sy * 0.9, 0]}>
            <coneGeometry args={[sx * 0.45, sy * 0.2, 16]} />
            {mat}
          </mesh>
        </group>
      );
  }
}

const AXIS = { x: 0, y: 1, z: 2 } as const;

/** One primitive and its motion, driven by formulas over the lab's parameters. */
function Primitive({ p, values, active }: { p: PrimitiveSpec; values: ParamValues; active: boolean }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const speed = useMemo(() => safeCompile(p.motion?.speed, 1), [p.motion?.speed]);
  const amp = useMemo(() => safeCompile(p.motion?.amplitude, 0.3), [p.motion?.amplitude]);
  const angle = useRef(0);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const swings = p.motion?.type === "oscillate";
  // A swinging shape pivots about its top end, like a pendulum bob on a string.
  const pivot: [number, number, number] = swings ? [p.position[0], p.position[1] + p.size[1] / 2, p.position[2]] : p.position;

  useFrame((s, delta) => {
    const m = p.motion;
    const g = outer.current;
    if (!m || !g) return;
    const vars = { ...valuesRef.current, t: s.clock.elapsedTime };
    const sp = speed(vars);
    const a = amp(vars);
    const i = AXIS[m.axis];
    const t = s.clock.elapsedTime;
    g.position.set(...pivot);
    g.rotation.set(...p.rotation);
    g.scale.setScalar(1);
    switch (m.type) {
      case "spin":
        angle.current += sp * Math.min(delta, 0.05);
        g.rotation.setFromVector3(new THREE.Vector3(...p.rotation).setComponent(i, p.rotation[i]! + angle.current));
        break;
      case "oscillate":
        g.rotation.setFromVector3(new THREE.Vector3(...p.rotation).setComponent(i, p.rotation[i]! + a * Math.sin(sp * t)));
        break;
      case "slide":
        g.position.setComponent(i, pivot[i]! + a * Math.sin(sp * t));
        break;
      case "pulse":
        g.scale.setScalar(1 + Math.abs(a) * 0.5 * (1 + Math.sin(sp * t)));
        break;
      case "flow": {
        const span = Math.max(0.1, Math.abs(a));
        g.position.setComponent(i, pivot[i]! + ((((sp * t) % span) + span) % span) - span / 2);
        break;
      }
      case "orbit": {
        angle.current += sp * Math.min(delta, 0.05);
        const v = new THREE.Vector3(...p.position).applyAxisAngle(new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0), angle.current);
        g.position.copy(v);
        break;
      }
    }
  });

  return (
    <group ref={outer} position={pivot} rotation={p.rotation}>
      <group ref={inner} position={swings ? [0, -p.size[1] / 2, 0] : [0, 0, 0]}>
        <Shape p={p} emissive={glow(active)} />
      </group>
    </group>
  );
}

/** Renders an AI-designed scene: simple shapes grouped into clickable parts, moving by real formulas. */
export function GenericModel({
  scene,
  parts,
  values,
  highlight,
  onSelect,
}: {
  scene: PrimitiveSpec[];
  parts: PartSpec[];
  values: ParamValues;
  highlight: string | null;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const groups = useMemo(() => {
    const byPart = new Map<string, PrimitiveSpec[]>();
    for (const p of scene) {
      const key = p.part && parts.some((x) => x.id === p.part) ? p.part : "__misc";
      byPart.set(key, [...(byPart.get(key) ?? []), p]);
    }
    return [...byPart.entries()];
  }, [scene, parts]);

  return (
    <group>
      {groups.map(([partId, prims]) => {
        const part = parts.find((x) => x.id === partId);
        const top = prims.reduce((m, p) => Math.max(m, p.position[1] + p.size[1] / 2), -Infinity);
        const cx = prims.reduce((s, p) => s + p.position[0], 0) / prims.length;
        const cz = prims.reduce((s, p) => s + p.position[2], 0) / prims.length;
        const body = prims.map((p) => <Primitive key={p.id} p={p} values={values} active={highlight === partId} />);
        return part ? (
          <Part key={partId} id={partId} active={highlight === partId} label={part.name} labelPosition={[cx, top + 0.45, cz]} onSelect={onSelect}>
            {body}
          </Part>
        ) : (
          <group key={partId}>{body}</group>
        );
      })}
    </group>
  );
}
