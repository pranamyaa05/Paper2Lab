import { useEffect, useRef } from "react";
import { drawSample } from "@/components/three/samples2d";
import type { TemplateId } from "@/labs/types";

/** A small rendering of one of the built-in textbook diagrams. */
export function SampleThumb({ id, className }: { id: Exclude<TemplateId, "generic">; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) drawSample(id, ctx, c.width, c.height);
  }, [id]);
  return <canvas ref={ref} width={600} height={420} className={className} aria-hidden />;
}
