import { useEffect, useRef } from "react";
import { drawPulleyDiagram } from "@/components/three/diagram2d";

const DETECTED = ["Block M", "Block m", "Pulley", "Incline θ", "String"];

/** The "photo" of the diagram, printed out as a flashcard with what the AI found. */
export function Flashcard() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    drawPulleyDiagram(ctx, c.width, c.height);
  }, []);
  return (
    <div className="animate-card-pop w-[min(78vw,20rem)]">
      <div className="glass-panel rounded-3xl p-3 pb-4">
        <div className="relative overflow-hidden rounded-2xl bg-card">
          <canvas ref={canvas} width={600} height={420} className="block h-auto w-full" />
          <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blush-deep">
            ● Captured
          </span>
        </div>
        <p className="mt-3 px-1 font-display text-base font-bold text-ink">Pulley on an incline</p>
        <p className="px-1 text-xs text-muted-foreground">Concept detected · Newton's 2nd law</p>
        <div className="mt-3 flex flex-wrap gap-1.5 px-1">
          {DETECTED.map((d, i) => (
            <span
              key={d}
              className="glass-convex tint-sky animate-chip-in rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ animationDelay: `${0.5 + i * 0.15}s` }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
