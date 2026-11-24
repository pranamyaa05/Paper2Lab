import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { PulleyScene } from "@/components/three/PulleyModel";
import { SceneLights } from "@/components/three/SceneLights";

const PARAMS = { M: 2, m: 3, thetaDeg: 30, mu: 0.1 };

function Turntable() {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.45 - 0.2;
  });
  return (
    <group ref={g} scale={0.92}>
      <PulleyScene params={PARAMS} highlight={null} />
    </group>
  );
}

/** A live pulley lab for the hero: the "after" to the textbook diagram's "before". */
export default function HeroScene() {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 38, position: [1.8, 2.6, 10.2] }} gl={{ alpha: true, antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 0.55, 0)}>
      <SceneLights />
      <Turntable />
    </Canvas>
  );
}
