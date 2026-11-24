import { useId, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pastel liquids, so neighbouring controls are easy to tell apart. */
const LIQUIDS = [
  ["#8fd0f5", "#6fa8f0"],
  ["#f9bfd2", "#ef8fb3"],
  ["#f8e08f", "#f0b85a"],
  ["#bfe8c9", "#7fcfa0"],
] as const;
export const liquid = (i: number) => LIQUIDS[((i % LIQUIDS.length) + LIQUIDS.length) % LIQUIDS.length]!;

const FLASK_BODY = "M10 2.5v6L4.8 17.7A2.6 2.6 0 0 0 7 21.5h10a2.6 2.6 0 0 0 2.2-3.8L14 8.5v-6z";

/** A conical flask that fills with liquid (0 to 1). Used as a mission checkbox and as the loading mascot. */
export function FlaskIcon({ fill = 0, tone = 0, className }: { fill?: number; tone?: number; className?: string }) {
  const id = useId();
  const [a, b] = liquid(tone);
  const full = fill >= 1;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("size-6 shrink-0", full ? "text-sky-deep" : "text-ink/35", className)}>
      <defs>
        <clipPath id={`${id}c`}>
          <path d={FLASK_BODY} />
        </clipPath>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect x="2" y="10" width="20" height="14" fill={`url(#${id}g)`} style={{ transform: `translateY(${(1 - Math.min(1, Math.max(0, fill))) * 12}px)`, transition: "transform 0.8s cubic-bezier(0.2,0.8,0.2,1)" }} />
        {full && <circle cx="10.5" cy="17" r="1" fill="#fff" opacity="0.8" />}
      </g>
      <path d="M9.5 2.5h5M10 2.5v6L4.8 17.7A2.6 2.6 0 0 0 7 21.5h10a2.6 2.6 0 0 0 2.2-3.8L14 8.5v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A flask with bubbles rising out of it: the app's loading animation. */
export function BubblingFlask({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block size-14", className)} role="img" aria-label="Loading">
      <FlaskIcon fill={0.6} tone={0} className="size-14 text-sky-deep" />
      {[
        ["42%", "0s"],
        ["54%", "0.7s"],
        ["48%", "1.4s"],
      ].map(([left, delay]) => (
        <span key={delay} aria-hidden className="animate-bubble absolute top-1 size-1.5 rounded-full bg-sky-deep/50" style={{ left, animationDelay: delay }} />
      ))}
    </span>
  );
}

/** Small digital readout, like the display on a bench instrument. */
export function Lcd({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("lcd", className)}>{children}</span>;
}

/** A slider drawn as a glass test tube: liquid rises to the handle, with measuring ticks underneath. */
export function TubeSlider({
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
  tone = 0,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  tone?: number;
}) {
  const [a, b] = liquid(tone);
  const p = (value - min) / (max - min || 1);
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink">{label}</span>
        <Lcd>{display}</Lcd>
      </span>
      <input
        type="range"
        className="tube-range mt-1.5"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={display}
        style={{ ["--p" as string]: p, ["--liquid-a" as string]: a, ["--liquid-b" as string]: b } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="tube-ticks" aria-hidden />
    </label>
  );
}

/** A bench switch with a pilot lamp: the lamp glows green when the switch is on. */
export function LabSwitch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-8 w-[3.6rem] shrink-0 rounded-full border border-white/80 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-deep/60",
        on ? "bg-gradient-to-b from-sky/80 to-sky-deep/60 shadow-[inset_0_2px_4px_var(--glass-shade)]" : "bg-white/70 shadow-[inset_0_2px_4px_var(--glass-shade)]",
      )}
    >
      <span aria-hidden className={cn("absolute top-1/2 size-2 -translate-y-1/2 rounded-full transition-all duration-300", on ? "left-2.5 bg-[#7be0b0] shadow-[0_0_8px_2px_#7be0b0]" : "right-2.5 bg-ink/20")} />
      <span aria-hidden className={cn("bubble-thumb absolute top-1 size-6 rounded-full transition-all duration-300", on ? "left-[calc(100%-1.75rem)]" : "left-1")} />
    </button>
  );
}

/** Progress shown as a measuring cylinder with one graduation per step. */
export function TubeProgress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, (value / (max || 1)) * 100);
  return (
    <div className="tube-progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} style={{ ["--n" as string]: max } as CSSProperties}>
      <div className="tube-progress-fill" style={{ width: `${pct}%` }}>
        {pct > 8 && (
          <>
            <i style={{ left: "18%" }} />
            <i style={{ left: "52%", animationDelay: "0.8s" }} />
            <i style={{ left: "82%", animationDelay: "1.5s" }} />
          </>
        )}
      </div>
      <span className="tube-progress-ticks" aria-hidden />
    </div>
  );
}
