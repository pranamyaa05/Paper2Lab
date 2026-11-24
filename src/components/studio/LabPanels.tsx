import { Loader2, Pencil, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FlaskIcon, LabSwitch, TubeProgress, TubeSlider } from "@/components/ui/lab";
import type { ActionSpec } from "@/labs/templates";
import type { LabSpec, ParamSpec, ParamValues, Readout } from "@/labs/types";
import { cn } from "@/lib/utils";

function fmt(p: ParamSpec, v: number) {
  const d = p.step >= 1 ? 0 : p.step >= 0.1 ? 1 : 2;
  return `${v.toFixed(d)}${p.unit ? ` ${p.unit}` : ""}`;
}

export function ControlsPanel({
  spec,
  values,
  readout,
  actions,
  onChange,
  onAction,
}: {
  spec: LabSpec;
  values: ParamValues;
  readout: Readout;
  actions: ActionSpec[];
  onChange: (id: string, v: number) => void;
  onAction: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white/55 p-4">
        <p className="font-display text-base font-extrabold leading-snug text-ink">{readout.headline}</p>
        {readout.stats.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {readout.stats.map((s) => (
              <div key={s.label} className={cn("rounded-xl bg-white/70 px-3 py-2", s.value.length > 22 && "col-span-2")}>
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                <dd className="font-display text-sm font-bold text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {spec.params.length > 0 && (
        <div className="space-y-4">
          {spec.params.map((p, i) => {
            const v = values[p.id] ?? p.value;
            if (p.kind === "toggle") {
              const on = v >= (p.min + p.max) / 2;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-ink">{p.label}</span>
                  <LabSwitch on={on} label={p.label} onChange={(next) => onChange(p.id, next ? p.max : p.min)} />
                </div>
              );
            }
            return <TubeSlider key={p.id} label={p.label} display={fmt(p, v)} min={p.min} max={p.max} step={p.step} value={v} tone={i} onChange={(x) => onChange(p.id, x)} />;
          })}
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.id} variant="glassOchre" lamp onClick={() => onAction(a.id)}>
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {spec.equations.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">The science</p>
          <ul className="mt-2 space-y-1.5">
            {spec.equations.map((e) => (
              <li key={e} className="rounded-xl bg-secondary px-3 py-2 font-mono text-xs text-ink">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PartsPanel({
  spec,
  highlight,
  onSelect,
  onRename,
}: {
  spec: LabSpec;
  highlight: string | null;
  onSelect: (id: string) => void;
  onRename?: ((id: string, name: string) => void) | undefined;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const active = spec.parts.find((p) => p.id === highlight);
  return (
    <div className="space-y-3">
      {active && (
        <div className="animate-caption-in rounded-2xl bg-white/70 p-4">
          <p className="font-display text-lg font-extrabold text-ink">{active.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{active.narration || active.short}</p>
        </div>
      )}
      <ul className="space-y-1.5">
        {spec.parts.map((p) => (
          <li key={p.id}>
            <div
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all",
                highlight === p.id ? "glass-convex tint-blush" : "hover:bg-white/60",
              )}
            >
              <span className="size-3 shrink-0 rounded-full border border-white shadow" style={{ background: p.color ?? "var(--sky-deep)" }} />
              {editing === p.id && onRename ? (
                <input
                  autoFocus
                  defaultValue={p.name}
                  className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1 text-sm font-bold text-ink outline-none ring-2 ring-sky"
                  onBlur={(e) => {
                    onRename(p.id, e.target.value.trim() || p.name);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(p.id)}>
                  <span className="block truncate font-display text-sm font-bold text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.short}</span>
                </button>
              )}
              {onRename && editing !== p.id && (
                <button className="rounded-full p-1.5 text-muted-foreground hover:bg-white/70 hover:text-ink" onClick={() => setEditing(p.id)} aria-label={`Rename ${p.name}`}>
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="px-1 text-xs text-muted-foreground">Tip: tap parts in the 3D view too.</p>
    </div>
  );
}

export interface ChatMessage {
  role: "you" | "tutor";
  text: string;
  via?: "ai" | "demo" | "local";
}

/** "Magnets (N and S)" → "magnets", for natural-sounding suggestions. */
const plain = (name: string) => name.replace(/\s*\(.*?\)/g, "").toLowerCase();

export function AskPanel({ spec, messages, busy, onAsk }: { spec: LabSpec; messages: ChatMessage[]; busy: boolean; onAsk: (q: string) => void }) {
  const [q, setQ] = useState("");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);
  const p0 = spec.params.find((p) => p.kind !== "toggle");
  const suggestions = [
    spec.parts[0] && `What ${/s$/.test(plain(spec.parts[0].name)) ? "do" : "does"} the ${plain(spec.parts[0].name)} do?`,
    p0 && `What if I increase the ${p0.label.toLowerCase()}?`,
    spec.template !== "generic" && "Why does it behave like this?",
    spec.parts[1] && `Explain the ${plain(spec.parts[1].name)}`,
  ].filter(Boolean) as string[];
  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    onAsk(t);
    setQ("");
  };
  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <div ref={list} className="flex-1 space-y-2.5 overflow-y-auto pr-1" style={{ maxHeight: "22rem" }}>
        {messages.length === 0 && (
          <div className="rounded-2xl bg-white/60 p-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-display font-bold text-ink">
              <Sparkles className="size-4 text-blush-deep" /> Ask your diagram
            </p>
            <p className="mt-1">Ask about any part, or try a "what if". I'll light up the part and change the simulation to show you.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("animate-chip-in max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm", m.role === "you" ? "ml-auto glass-convex tint-sky font-semibold" : "bg-white/75 text-ink")}>
            {m.text}
            {m.role === "tutor" && m.via && m.via !== "ai" && (
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.via === "local" ? "Instant answer · no AI needed" : "Demo tutor"}</span>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex w-fit items-center gap-2 rounded-2xl bg-white/75 px-3.5 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking…
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.slice(0, 3).map((s) => (
          <button key={s} onClick={() => submit(s)} className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-ink hover:bg-white">
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. What if the angle is 45°?"
          className="min-w-0 flex-1 rounded-full border border-white/80 bg-white/80 px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-sky"
          aria-label="Ask a question about the diagram"
        />
        <Button type="submit" variant="glassBlush" size="round" disabled={busy || !q.trim()} aria-label="Send question">
          <Send />
        </Button>
      </form>
    </div>
  );
}

export interface MissionView {
  id: string;
  goal: string;
  hint: string;
  /** Done right now, or earned in an earlier visit. */
  done: boolean;
}

export interface NextLab {
  id: string;
  title: string;
}

/** Goals that give students a reason to move the sliders. Done ones tick off live. */
export function MissionsPanel({
  missions,
  justDone,
  next,
  onOpenLab,
  onUpload,
}: {
  missions: MissionView[];
  justDone: string | null;
  /** Labs to suggest once every mission here is done. */
  next: NextLab[];
  onOpenLab: (id: string) => void;
  onUpload: () => void;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const done = missions.filter((m) => m.done).length;
  const startId = missions.find((m) => !m.done)?.id;
  if (!missions.length) return null;
  const all = done === missions.length;
  return (
    <div className="rounded-2xl bg-white/65 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-base font-extrabold text-ink">Your missions</p>
        <span className="text-xs font-extrabold text-ink/55">
          {done} of {missions.length} done
        </span>
      </div>
      <div className="mt-2">
        <TubeProgress value={done} max={missions.length} label="Missions completed" />
      </div>
      <ul className="mt-3 space-y-2">
        {missions.map((m, i) => (
          <li key={m.id} className={cn("rounded-xl px-3 py-2 transition-colors", m.done ? "bg-sky/35" : "bg-white/70", m.id === startId && !all && "ring-2 ring-blush-deep/50", justDone === m.id && "animate-card-pop")}>
            <div className="flex items-start gap-2.5">
              <FlaskIcon fill={m.done ? 1 : 0} tone={i} className="mt-px" />
              <div className="min-w-0 flex-1">
                {m.id === startId && done === 0 && <span className="mb-0.5 inline-block rounded-full bg-blush-deep px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">Start here</span>}
                <p className={cn("text-sm font-bold text-ink", m.done && "text-ink/60")}>
                  <span className="sr-only">{m.done ? "Done: " : "To do: "}</span>
                  {m.goal}
                </p>
              </div>
              {!m.done && (
                <button onClick={() => setHint((h) => (h === m.id ? null : m.id))} className="min-h-8 shrink-0 rounded-full px-2.5 text-xs font-bold text-sky-deep hover:underline" aria-expanded={hint === m.id}>
                  Hint
                </button>
              )}
            </div>
            {hint === m.id && !m.done && <p className="mt-1.5 pl-7 text-xs font-semibold text-ink/65">{m.hint}</p>}
          </li>
        ))}
      </ul>
      {all && (
        <div className="animate-caption-in mt-4 rounded-2xl bg-gradient-to-br from-sky/40 via-white/60 to-blush/40 p-4 text-center">
          <p className="font-display text-base font-extrabold text-ink">All missions complete. Brilliant work! 🎉</p>
          <p className="mt-1 text-xs font-semibold text-ink/60">What would you like to explore next?</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {next.map((n) => (
              <Button key={n.id} variant="glassSky" size="sm" className="min-h-10" onClick={() => onOpenLab(n.id)}>
                {n.title}
              </Button>
            ))}
            <Button variant="glassBlush" size="sm" className="min-h-10" onClick={onUpload}>
              Use my own diagram
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
