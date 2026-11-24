import { Atom, Clock, FlaskConical, Leaf, Play, Target } from "lucide-react";
import { useState } from "react";
import { SampleThumb } from "@/components/studio/SampleThumb";
import { Button } from "@/components/ui/Button";
import { TEMPLATE_LIST, type TemplateDef } from "@/labs/templates";
import { SUBJECTS, type Subject } from "@/labs/types";
import { cn } from "@/lib/utils";

const META: Record<Subject, { label: string; icon: typeof Atom; tint: string; bg: string; button: "glassSky" | "glassOchre" | "glassBlush" }> = {
  physics: { label: "Physics", icon: Atom, tint: "tint-sky", bg: "bg-sky/45", button: "glassSky" },
  biology: { label: "Biology", icon: Leaf, tint: "tint-ochre", bg: "bg-ochre/45", button: "glassOchre" },
  chemistry: { label: "Chemistry", icon: FlaskConical, tint: "tint-blush", bg: "bg-blush/45", button: "glassBlush" },
};

/** The lab library, filterable by subject. Each card says what you'll do, for how long, at what level. */
export function LabPicker({ onPick }: { onPick: (id: TemplateDef["id"]) => void }) {
  const [subject, setSubject] = useState<Subject | "all">("all");
  const labs = subject === "all" ? TEMPLATE_LIST : TEMPLATE_LIST.filter((t) => t.subject === subject);
  return (
    <section id="labs" className="relative scroll-mt-24 px-4 py-16 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-sky-deep">Lab library</p>
            <h2 className="mt-2 font-display text-4xl font-extrabold text-ink md:text-5xl">Or open a ready-made lab</h2>
            <p className="mt-2 max-w-xl text-lg text-ink/65">Each lab has missions to complete. No upload needed.</p>
          </div>
          <div role="tablist" aria-label="Filter by subject" className="glass-panel flex flex-wrap gap-1 rounded-full p-1.5">
            {(["all", ...SUBJECTS] as const).map((s) => {
              const M = s === "all" ? null : META[s];
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={subject === s}
                  onClick={() => setSubject(s)}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-full px-4 font-display text-sm font-bold transition-all",
                    subject === s ? cn("glass-convex", M?.tint ?? "tint-rainbow") : "text-ink/60 hover:text-ink",
                  )}
                >
                  {M && <M.icon className="size-4" />} {M ? M.label : "All"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {labs.map((t) => {
            const M = META[t.subject];
            return (
              <article key={t.id} className="glass-panel group flex flex-col overflow-hidden rounded-[2rem] p-2.5 transition-transform hover:-translate-y-1">
                <button onClick={() => onPick(t.id)} className={cn("relative overflow-hidden rounded-[1.5rem] p-3", M.bg)} aria-label={`Open the ${t.title} lab`}>
                  <SampleThumb id={t.id} className="block h-auto w-full rounded-2xl bg-white shadow-sm transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute left-5 top-5 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-extrabold text-ink">
                    <M.icon className="size-3.5" /> {M.label}
                  </span>
                </button>
                <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
                  <h3 className="font-display text-xl font-extrabold text-ink">{t.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ink/55">
                    <span>{t.level}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" /> {t.minutes} min
                    </span>
                  </p>
                  <p className="mt-3 flex items-start gap-2 rounded-2xl bg-white/60 px-3 py-2.5 text-sm font-semibold text-ink">
                    <Target className="mt-0.5 size-4 shrink-0 text-blush-deep" />
                    <span>
                      <span className="text-ink/55">Mission: </span>
                      {t.missions[0]?.goal}
                      <span className="text-ink/50"> +{t.missions.length - 1} more</span>
                    </span>
                  </p>
                  <div className="mt-auto pt-4">
                    <Button variant={M.button} className="w-full min-h-11" onClick={() => onPick(t.id)}>
                      <Play /> Open lab
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
