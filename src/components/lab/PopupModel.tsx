import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { PartLabel } from "@/components/three/Highlight";
import type { Segmentation } from "@/lib/analyze/segment";

export const POPUP_WIDTH = 5.2;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * The uploaded diagram as a pop-up: every coloured region of the drawing rises off the page as a
 * block of voxels. `progress` (0→1) drives the materialize animation; regions are clickable parts.
 */
export function PopupModel({
  seg,
  aspect,
  imageUrl,
  progress,
  explode = 0.25,
  depth = 1,
  spin = false,
  highlight,
  onSelect,
  names,
}: {
  names?: Record<string, string> | undefined;
  seg: Segmentation;
  aspect: number;
  imageUrl: string;
  progress: MutableRefObject<number>;
  explode?: number;
  depth?: number;
  spin?: boolean;
  highlight: string | null;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const root = useRef<THREE.Group>(null);
  const W = POPUP_WIDTH;
  const D = W / aspect;
  const cs = W / seg.w;

  const cells = useMemo(() => {
    const out: { x: number; z: number; region: number; dist: number }[] = [];
    for (let i = 0; i < seg.labels.length; i++) {
      const r = seg.labels[i]!;
      if (r < 0) continue;
      const gx = i % seg.w;
      const gy = (i - gx) / seg.w;
      const x = (gx + 0.5) * cs - W / 2;
      const z = (gy + 0.5) * (D / seg.h) - D / 2;
      out.push({ x, z, region: r, dist: Math.hypot(x / W, z / D) });
    }
    return out;
  }, [seg, cs, W, D]);

  // Smaller regions sit on higher layers so details pop out above big background shapes.
  const layer = useMemo(() => {
    const order = [...seg.regions].filter((r) => !r.ink).sort((a, b) => b.area - a.area);
    const m = new Map<number, number>();
    order.forEach((r, i) => m.set(r.index, i + 1));
    seg.regions.filter((r) => r.ink).forEach((r) => m.set(r.index, 0));
    return m;
  }, [seg]);

  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(imageUrl);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [imageUrl]);
  useEffect(() => () => texture.dispose(), [texture]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const last = useRef({ p: -1, explode: -1, depth: -1 });
  const hiIndex = highlight?.startsWith("region-") ? Number(highlight.slice(7)) : -1;

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    cells.forEach((cell, i) => {
      const reg = seg.regions[cell.region]!;
      c.setRGB(reg.rgb[0] / 255, reg.rgb[1] / 255, reg.rgb[2] / 255, THREE.SRGBColorSpace);
      if (hiIndex >= 0) {
        if (cell.region === hiIndex) c.offsetHSL(0, 0.05, 0.1);
        else c.lerp(new THREE.Color("#e8eef8"), 0.6);
      }
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    last.current.p = -1; // a remounted mesh needs its matrices written again
  }, [cells, seg, hiIndex]);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    if (spin && root.current) root.current.rotation.y += Math.min(delta, 0.05) * 0.4;
    const p = progress.current;
    const L = last.current;
    if (Math.abs(L.p - p) < 1e-4 && L.explode === explode && L.depth === depth) return;
    L.p = p;
    L.explode = explode;
    L.depth = depth;
    cells.forEach((cell, i) => {
      const reg = seg.regions[cell.region]!;
      const lay = layer.get(cell.region) ?? 0;
      const rise = smooth(p * 1.8 - cell.dist * 0.8);
      const h = (reg.ink ? 0.07 : 0.16 + 0.07 * (lay % 4)) * depth;
      const lift = reg.ink ? 0.02 + explode * 0.15 : explode * 0.28 * lay;
      const height = Math.max(0.002, h * rise);
      dummy.position.set(cell.x, height / 2 + lift * rise + 0.01, cell.z);
      dummy.scale.set(cs * 0.98, height, (D / seg.h) * 0.98);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined || !onSelect) return;
    e.stopPropagation();
    onSelect(`region-${cells[e.instanceId]!.region}`);
  };

  const hiRegion = hiIndex >= 0 ? seg.regions[hiIndex] : undefined;
  const labelPos: [number, number, number] | null = hiRegion
    ? [hiRegion.centroid[0] * W - W / 2, 0.6 + explode * 0.28 * (layer.get(hiIndex) ?? 0) + 0.3 * depth, hiRegion.centroid[1] * D - D / 2]
    : null;

  return (
    <group ref={root}>
      {/* the page itself */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={texture} roughness={0.9} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[W + 0.2, 0.06, D + 0.2]} />
        <meshStandardMaterial color="#fbf7ec" roughness={0.95} />
      </mesh>
      <instancedMesh
        key={cells.length}
        ref={mesh}
        args={[undefined, undefined, cells.length]}
        onClick={onClick}
        onPointerOver={() => onSelect && (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.45} />
      </instancedMesh>
      {hiRegion && labelPos && <PartLabel label={names?.[`region-${hiRegion.index}`] ?? hiRegion.name} position={labelPos} />}
    </group>
  );
}
