import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type * as THREE from "three";

/**
 * Shared component registry on the 3D side: part id → its objects in the scene.
 * The tutor's "focus on <part>" action looks parts up here to aim the camera.
 */
export type PartObjects = Map<string, Set<THREE.Object3D>>;
export const PartRegistry = createContext<PartObjects | null>(null);

/** Glow amount for a highlighted part; used as emissiveIntensity. */
export function glow(active: boolean) {
  return active ? 0.6 : 0;
}

/** Wraps a clickable part: pointer cursor, select on click, floating label while active. */
export function Part({
  id,
  active,
  label,
  labelPosition = [0, 0.8, 0],
  onSelect,
  children,
}: {
  id: string;
  active: boolean;
  label: string;
  /** null: the caller renders <PartLabel> itself (e.g. inside a moving group). */
  labelPosition?: [number, number, number] | null;
  onSelect?: ((id: string) => void) | undefined;
  children: ReactNode;
}) {
  const registry = useContext(PartRegistry);
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    const g = group.current;
    if (!registry || !g) return;
    const set = registry.get(id) ?? new Set();
    set.add(g);
    registry.set(id, set);
    return () => void set.delete(g);
  }, [registry, id]);
  const handlers = onSelect
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(id);
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          document.body.style.cursor = "";
        },
      }
    : {};
  return (
    <group ref={group} {...handlers}>
      {children}
      {active && labelPosition && <PartLabel label={label} position={labelPosition} />}
    </group>
  );
}

export function PartLabel({ label, position }: { label: string; position: [number, number, number] }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="glass-panel animate-chip-in whitespace-nowrap rounded-full px-3 py-1 font-display text-xs font-bold text-ink">
        {label}
      </div>
    </Html>
  );
}
