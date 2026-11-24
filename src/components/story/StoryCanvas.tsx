import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { SceneLights } from "@/components/three/SceneLights";
import { PulleyScene } from "@/components/three/PulleyModel";
import { Book } from "./Book";

type Key = { p: number; pos: [number, number, number]; target: [number, number, number] };

const KEYS: Key[] = [
  { p: 0, pos: [0, 2.6, 6.4], target: [0, -0.4, 0] },
  { p: 0.12, pos: [0, 2.8, 6.0], target: [0, -0.2, 0] },
  { p: 0.32, pos: [0, 4.3, 3.4], target: [0, 0, 0.15] },
  { p: 0.44, pos: [0.82, 3.05, 0.75], target: [0.82, 0, 0.02] },
  { p: 0.58, pos: [0.82, 2.9, 0.7], target: [0.82, 0, 0.02] },
  { p: 0.72, pos: [0, 1.6, 9.2], target: [0, 0.4, 0] },
  { p: 1, pos: [2.4, 2.4, 8.4], target: [0, 0.4, 0] },
];

const smooth = (x: number) => x * x * (3 - 2 * x);

function sampleCamera(p: number, pos: THREE.Vector3, target: THREE.Vector3) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1]!.p) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const t = smooth(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
  pos.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
  target.set(...a.target).lerp(new THREE.Vector3(...b.target), t);
}

function CameraRig({ progress }: { progress: MutableRefObject<number> }) {
  const goalPos = useMemo(() => new THREE.Vector3(), []);
  const goalTarget = useMemo(() => new THREE.Vector3(), []);
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useFrame((_, delta) => {
    sampleCamera(progress.current, goalPos, goalTarget);
    // Pull back on narrow (portrait) screens so the scene still fits.
    const aspect = size.width / size.height;
    if (aspect < 1) goalPos.sub(goalTarget).multiplyScalar(1 + (1 - aspect) * 0.9).add(goalTarget);
    const k = 1 - Math.exp(-6 * Math.min(delta, 0.05));
    camera.position.lerp(goalPos, k);
    look.current.lerp(goalTarget, k);
    camera.lookAt(look.current);
  });
  return null;
}

function LabRise({ progress, highlight }: { progress: MutableRefObject<number>; highlight: string | null }) {
  const g = useRef<THREE.Group>(null);
  const params = useMemo(() => ({ M: 2, m: 3, thetaDeg: 30, mu: 0.1 }), []);
  useFrame(() => {
    if (!g.current) return;
    const t = Math.min(1, Math.max(0, (progress.current - 0.62) / 0.12));
    const e = smooth(t);
    g.current.visible = t > 0.001;
    g.current.scale.setScalar(0.2 + 0.8 * e);
    g.current.position.y = -3 * (1 - e);
    g.current.rotation.y = (1 - e) * -1.2;
  });
  return (
    <group ref={g} visible={false}>
      <PulleyScene params={params} highlight={highlight} />
    </group>
  );
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) onReady();
  });
  return null;
}

export default function StoryCanvas({
  progress,
  highlight,
}: {
  progress: MutableRefObject<number>;
  highlight: string | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas dpr={[1, 1.75]} camera={{ fov: 40, position: [0, 2.6, 6.4], near: 0.1, far: 60 }} gl={{ alpha: true, antialias: true }}>
        <SceneLights />
        <CameraRig progress={progress} />
        <Book progress={progress} />
        <LabRise progress={progress} highlight={highlight} />
        <ReadySignal onReady={() => wrap.current?.setAttribute("data-scene-ready", "true")} />
      </Canvas>
    </div>
  );
}
