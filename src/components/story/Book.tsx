import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { makeCoverTexture, makePageTexture } from "@/components/three/textures";

const PAGE_W = 1.55;
const PAGE_D = 2.1;
const PAGES = 6;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Textbook whose cover opens and pages flip as the story progress moves from 0.12 to 0.32. */
export function Book({ progress }: { progress: MutableRefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const cover = useRef<THREE.Group>(null);
  const pages = useRef<(THREE.Group | null)[]>([]);

  const tex = useMemo(
    () => ({
      cover: makeCoverTexture(),
      diagram: makePageTexture("diagram", 3),
      inner: makePageTexture("text", 2),
      flips: Array.from({ length: PAGES }, (_, i) => makePageTexture("text", 10 + i)),
    }),
    [],
  );
  useEffect(
    () => () => {
      tex.cover.dispose();
      tex.diagram.dispose();
      tex.inner.dispose();
      tex.flips.forEach((t) => t.dispose());
    },
    [tex],
  );

  const coverMaterials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: "#b9d7f3", roughness: 0.6 });
    return [
      side,
      side,
      new THREE.MeshStandardMaterial({ map: tex.cover, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ map: tex.inner, roughness: 0.9 }),
      side,
      side,
    ];
  }, [tex]);
  useEffect(() => () => coverMaterials.forEach((m) => m.dispose()), [coverMaterials]);

  useFrame((state) => {
    const p = progress.current;
    const open = clamp01((p - 0.12) / 0.2);
    const t = state.clock.elapsedTime;
    if (root.current) {
      const idle = 1 - open;
      const leave = ease((p - 0.6) / 0.12);
      root.current.position.set(-0.8 * (1 - ease(open)), 0.3 * idle - 5 * leave, 0);
      root.current.rotation.set(0.75 * idle + 0.6 * leave, Math.sin(t * 0.6) * 0.18 * idle - 0.25 * idle, 0);
      root.current.scale.setScalar(1 - 0.4 * leave);
      root.current.visible = leave < 0.999;
    }
    const coverT = ease(open / 0.35);
    if (cover.current) {
      cover.current.rotation.z = coverT * Math.PI;
      cover.current.position.y = 0.16 - 0.15 * coverT;
    }
    pages.current.forEach((g, i) => {
      if (!g) return;
      const k = ease((open - (0.22 + i * 0.09)) / 0.28);
      g.rotation.z = k * (Math.PI - 0.01 * (i + 1));
      const yRight = 0.133 + (PAGES - i) * 0.002;
      const yLeft = 0.035 + i * 0.003;
      g.position.y = yRight + (yLeft - yRight) * k + Math.sin(k * Math.PI) * 0.15;
    });
  });

  return (
    <group ref={root}>
      {/* back cover + spine */}
      <mesh position={[0.82, 0, 0]}>
        <boxGeometry args={[1.66, 0.04, 2.24]} />
        <meshStandardMaterial color="#a9cdee" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[0.06, 0.18, 2.24]} />
        <meshStandardMaterial color="#9cc3e8" roughness={0.6} />
      </mesh>
      {/* page block */}
      <mesh position={[0.81, 0.075, 0]}>
        <boxGeometry args={[1.56, 0.11, 2.12]} />
        <meshStandardMaterial color="#f6f0df" roughness={0.95} />
      </mesh>
      {/* the diagram page */}
      <mesh position={[0.81, 0.132, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[PAGE_W, PAGE_D]} />
        <meshStandardMaterial map={tex.diagram} roughness={0.9} />
      </mesh>
      {/* flipping pages, top first */}
      {tex.flips.map((map, i) => (
        <group key={i} ref={(el) => void (pages.current[i] = el)} position={[0, 0.14, 0]}>
          <mesh position={[PAGE_W / 2 + 0.03, 0, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[PAGE_W, PAGE_D]} />
            <meshStandardMaterial map={map} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* front cover hinged on the spine */}
      <group ref={cover} position={[0, 0.16, 0]}>
        <mesh position={[0.83, 0, 0]} material={coverMaterials}>
          <boxGeometry args={[1.66, 0.04, 2.24]} />
        </mesh>
      </group>
    </group>
  );
}
