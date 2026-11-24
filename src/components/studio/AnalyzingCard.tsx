import { Check, Loader2 } from "lucide-react";
import { BubblingFlask } from "@/components/ui/lab";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = ["Reading the picture", "Finding parts and labels", "Choosing the right science", "Materializing in 3D"];

/** The diagram on a flashcard with a scanning beam, while the analysis runs. */
export function AnalyzingCard({ imageUrl, name, ai }: { imageUrl: string; name: string; ai: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), ai ? 1400 : 450);
    return () => clearInterval(id);
  }, [ai]);
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
      <div className="animate-card-pop mx-auto w-full max-w-xl">
        <div className="glass-panel rounded-[2rem] p-3 pb-4">
          <div className="relative overflow-hidden rounded-3xl bg-white">
            <img src={imageUrl} alt={`Diagram being analysed: ${name}`} className="block max-h-[52vh] w-full object-contain" />
            <div className="animate-scan-line pointer-events-none absolute inset-x-0 h-16 -translate-y-1/2 bg-gradient-to-b from-transparent via-sky/70 to-transparent" />
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-blush-deep">● Analysing</span>
          </div>
          <p className="mt-3 truncate px-2 font-display text-base font-bold text-ink">{name}</p>
        </div>
      </div>
      <ol className="space-y-3">
        <li className="flex justify-center md:justify-start">
          <BubblingFlask />
        </li>
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn("glass-panel flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-500", i > step && "opacity-40", i === step && "scale-[1.02]")}
          >
            <span className={cn("grid size-8 place-items-center rounded-full", i < step ? "glass-convex tint-sky" : i === step ? "glass-convex tint-ochre" : "bg-white/60")}>
              {i < step ? <Check className="size-4" /> : i === step ? <Loader2 className="size-4 animate-spin" /> : <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>}
            </span>
            <span className="font-display font-bold text-ink">{s}</span>
          </li>
        ))}
        <li className="px-2 text-xs text-muted-foreground">{ai ? "Gemini is reading your diagram…" : "Demo mode: analysing on this device, no data leaves your browser."}</li>
      </ol>
    </div>
  );
}
