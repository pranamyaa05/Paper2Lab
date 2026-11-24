import { FlaskConical, Info, Languages, LocateFixed, MessageCircleQuestion, Microscope, Pause, Play, Sparkles, Target, Volume2, VolumeX, Wand2, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { BubblingFlask } from "@/components/ui/lab";
import { BuddyCorner, type BuddyMood } from "@/components/ui/StudyBuddy";
import { LANGUAGES, prepareTranslations, type Voice } from "@/hooks/use-voice";
import { actionsFor, defaultValues, describeLab, TEMPLATE_LIST, TEMPLATES, type TemplateDef } from "@/labs/templates";
import type { LabSpec, ParamValues } from "@/labs/types";
import type { Analysis } from "@/lib/analyze";
import { askDiagram } from "@/lib/ask";
import { markDone, useProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import type { CameraCommand, LabTicks } from "@/components/lab/LabCanvas";
import type { TutorAction } from "@/lib/ask";
import { AskPanel, ControlsPanel, MissionsPanel, PartsPanel, type ChatMessage, type MissionView } from "./LabPanels";

const LabCanvas = lazy(() => import("@/components/lab/LabCanvas"));

type Tab = "controls" | "parts" | "ask";

const STRIPE = { physics: "var(--sky-deep)", biology: "var(--ochre-deep)", chemistry: "var(--blush-deep)" } as const;

function initialTicks(spec: LabSpec): LabTicks {
  // Fire the neuron and drip the indicator once as soon as the lab appears.
  return Object.fromEntries(actionsFor(spec).map((a) => [a.id, a.id === "stimulate" || a.id === "drop" ? 1 : 0]));
}

/** The diagram the student gave us, with the highlighted part outlined. Folds away so it never hides the model. */
function SourceCard({ imageUrl, spec, highlight }: { imageUrl: string; spec: LabSpec; highlight: string | null }) {
  const [open, setOpen] = useState(true);
  const part = spec.parts.find((p) => p.id === highlight);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="glass-panel rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink">
        Show your diagram
      </button>
    );
  return (
    <div className="glass-panel w-28 rounded-2xl p-1.5 md:w-40">
      <div className="relative overflow-hidden rounded-xl bg-white">
        <img src={imageUrl} alt="Your diagram" className="block h-auto w-full" />
        {part?.bbox && (
          <span
            className="absolute rounded-md border-2 border-blush-deep bg-blush/25 transition-all duration-300"
            style={{ left: `${part.bbox[0] * 100}%`, top: `${part.bbox[1] * 100}%`, width: `${part.bbox[2] * 100}%`, height: `${part.bbox[3] * 100}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between px-1 pt-1">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Your diagram</p>
        <button onClick={() => setOpen(false)} className="rounded-full px-1.5 text-xs font-bold text-muted-foreground hover:text-ink" aria-label="Hide your diagram">
          ×
        </button>
      </div>
    </div>
  );
}

export function LabView({
  analysis,
  imageUrl,
  voice,
  onNew,
  onPickTemplate,
  onOpenSample,
}: {
  analysis: Analysis;
  imageUrl: string;
  voice: Voice;
  onNew: () => void;
  onPickTemplate: (id: TemplateDef["id"]) => void;
  onOpenSample: (id: TemplateDef["id"]) => void;
}) {
  const [spec, setSpec] = useState<LabSpec>(analysis.spec);
  const [values, setValues] = useState<ParamValues>(() => defaultValues(analysis.spec));
  const [ticks, setTicks] = useState<LabTicks>(() => initialTicks(analysis.spec));
  const [highlight, setHighlight] = useState<string | null>(null);
  const [phase, setPhase] = useState<"materialize" | "lab">("materialize");
  const [tab, setTab] = useState<Tab>("controls");
  const [voiceOn, setVoiceOn] = useState(true);
  const [tour, setTour] = useState(-1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const runKey = useMemo(() => `${analysis.spec.title}-${Date.now()}`, [analysis]);
  const { speak, stop } = voice;

  // Bubbles, the study buddy, says everything: it shows in the speech bubble and is spoken when the voice is on.
  const [line, setLine] = useState<{ id: number; text: string; tip?: string | undefined; localized: boolean } | null>(null);
  const [bubbleOpen, setBubbleOpen] = useState(true);
  const lineId = useRef(0);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const say = (text: string, opts?: { tip?: string; onEnd?: () => void; localized?: boolean }) => {
    const id = ++lineId.current;
    const localized = !!opts?.localized;
    setLine({ id, text, tip: opts?.tip, localized });
    setBubbleOpen(true);
    if (voiceOnRef.current) void speak(text, opts?.onEnd, { translated: localized });
    // Show the line in the chosen language as soon as the translation is ready.
    if (!localized && !voice.language.startsWith("en")) {
      void voice.localize(text).then((t) => setLine((l) => (l && l.id === id ? { ...l, text: t, localized: true } : l)));
    }
  };
  const sayRef = useRef(say);
  sayRef.current = say;
  // On phones the speech bubble would cover the model, so it tucks itself away once it has been read.
  useEffect(() => {
    if (!line || typeof window === "undefined" || !window.matchMedia("(max-width: 639px)").matches) return;
    const t = setTimeout(() => setBubbleOpen(false), Math.max(7000, line.text.length * 70));
    return () => clearTimeout(t);
  }, [line?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [camera, setCamera] = useState<CameraCommand | null>(null);
  const nonce = useRef(0);
  const cam = useCallback((c: { kind: "focus"; part: string } | { kind: "rotate" } | { kind: "reset" }) => setCamera({ ...c, nonce: ++nonce.current } as CameraCommand), []);

  useEffect(() => {
    setSpec(analysis.spec);
    setValues(defaultValues(analysis.spec));
    setTicks(initialTicks(analysis.spec));
    setHighlight(null);
    setTour(-1);
    setMessages([]);
    stop();
  }, [analysis, stop]);

  const readout = useMemo(() => describeLab(spec, values), [spec, values]);

  // Efficiency: translate the intro and every part's narration in one batch as soon as a language is picked.
  useEffect(() => {
    void prepareTranslations([spec.intro, ...spec.parts.map((p) => p.narration)], voice.language);
  }, [spec.intro, spec.parts, voice.language]);
  const partNames = useMemo(() => Object.fromEntries(spec.parts.map((p) => [p.id, p.name])), [spec.parts]);
  const isPopup = spec.template === "generic" && !spec.scene?.length;

  // Introduce the lab once it has materialized.
  const introduced = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "lab" || introduced.current === runKey) return;
    introduced.current = runKey;
    sayRef.current(spec.intro, { tip: "Drag to turn the model · tap any part · try the missions" });
  }, [phase, runKey, spec.intro]);
  useEffect(() => {
    if (!voiceOn) stop();
  }, [voiceOn, stop]);

  const selectPart = useCallback(
    (id: string) => {
      setTour(-1);
      setHighlight((h) => (h === id ? null : id));
      setTab((t) => (t === "ask" ? t : "parts"));
      const part = spec.parts.find((p) => p.id === id);
      if (part && highlight !== id) sayRef.current(part.narration || part.name);
    },
    [spec.parts, highlight],
  );

  // Guided tour: each part lights up while it is explained, then the next one.
  useEffect(() => {
    if (tour < 0) return;
    const part = spec.parts[tour];
    if (!part) {
      setTour(-1);
      setHighlight(null);
      cam({ kind: "reset" });
      return;
    }
    setHighlight(part.id);
    cam({ kind: "focus", part: part.id });
    let cancelled = false;
    const next = () => !cancelled && setTour((t) => (t >= 0 ? t + 1 : t));
    let timer: ReturnType<typeof setTimeout> | undefined;
    sayRef.current(part.narration || part.name, { onEnd: next });
    if (!voiceOn) timer = setTimeout(next, 4500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tour, spec.parts, voiceOn, cam]);

  /** Run the tutor's actions in the 3D view, in order. A rotate waits until a camera move has landed. */
  const runActions = (actions: TutorAction[]) => {
    let focused = false;
    for (const a of actions) {
      if (a.type === "highlight") setHighlight(a.part);
      else if (a.type === "focus") {
        cam({ kind: "focus", part: a.part });
        focused = true;
      } else if (a.type === "set") setValues((v) => ({ ...v, [a.param]: a.value }));
      else if (a.type === "trigger") setTicks((t) => ({ ...t, [a.action]: (t[a.action] ?? 0) + 1 }));
      else if (a.type === "rotate") setTimeout(() => cam({ kind: "rotate" }), focused ? 1400 : 0);
    }
  };

  const ask = async (q: string) => {
    setMessages((m) => [...m, { role: "you", text: q }]);
    setBusy(true);
    setTour(-1);
    try {
      const a = await askDiagram(spec, values, q, voice.language);
      setMessages((m) => [...m, { role: "tutor", text: a.answer, via: a.via }]);
      runActions(a.actions);
      say(a.answer, { localized: a.via === "ai" });
    } finally {
      setBusy(false);
    }
  };

  // Missions: checked live against the sliders (and action counters, e.g. reversing the motor),
  // and remembered across visits so progress shows up on the lab cards too.
  const progress = useProgress();
  const earned = useMemo(() => new Set(spec.template === "generic" ? [] : (progress[spec.template] ?? [])), [progress, spec.template]);
  const live = useMemo(() => {
    if (spec.template === "generic") return [];
    const v = { ...values, ...ticks };
    return TEMPLATES[spec.template].missions.map((m) => ({ id: m.id, goal: m.goal, hint: m.hint, now: m.done(v) }));
  }, [spec.template, values, ticks]);
  const missions: MissionView[] = useMemo(() => live.map((m) => ({ id: m.id, goal: m.goal, hint: m.hint, done: m.now || earned.has(m.id) })), [live, earned]);

  const [justDone, setJustDone] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; goal: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const doneBefore = useRef<Set<string> | null>(null);
  useEffect(() => {
    doneBefore.current = null;
  }, [spec.template, runKey]);
  useEffect(() => {
    const now = new Set(live.filter((m) => m.now).map((m) => m.id));
    const prev = doneBefore.current;
    doneBefore.current = now;
    if (!prev) return; // first render: things already true at the start don't count as achievements
    const fresh = live.find((m) => m.now && !prev.has(m.id));
    if (fresh && spec.template !== "generic") {
      markDone(spec.template, fresh.id);
      setJustDone(fresh.id);
      setToast({ id: fresh.id, goal: fresh.goal });
      setAnnouncement(`Mission complete: ${fresh.goal}`);
      sayRef.current(`Mission complete! ${fresh.goal}.`);
      try {
        navigator.vibrate?.(30);
      } catch {
        // not supported on this device
      }
    }
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  // What to suggest after the last mission: unfinished labs first, same subject before others.
  const nextLabs = useMemo(() => {
    const score = (t: (typeof TEMPLATE_LIST)[number]) => ((progress[t.id]?.length ?? 0) >= t.missions.length ? 2 : t.subject === spec.subject ? 0 : 1);
    return TEMPLATE_LIST.filter((t) => t.id !== spec.template)
      .sort((x, y) => score(x) - score(y))
      .slice(0, 2)
      .map((t) => ({ id: t.id, title: t.title }));
  }, [progress, spec.template, spec.subject]);

  const mood: BuddyMood = busy ? "thinking" : toast ? "cheer" : "idle";

  return (
    <div className="space-y-4">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {/* Title bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <span className="lab-label" style={{ ["--stripe" as string]: STRIPE[spec.subject] }}>
            {spec.subject}
          </span>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">{spec.title}</h2>
          <p className="text-base font-semibold text-ink/60">{spec.concept}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={voiceOn ? "glassBlush" : "glass"} className="min-h-11" onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn}>
            {voiceOn ? <Volume2 /> : <VolumeX />} {voiceOn ? "Voice on" : "Voice off"}
          </Button>
          <label className="glass-panel flex min-h-11 items-center gap-1.5 rounded-full pl-3.5 pr-2 text-sm font-bold text-ink">
            <Languages className="size-4 text-sky-deep" />
            <span className="sr-only">Language</span>
            <select value={voice.language} onChange={(e) => voice.setLanguage(e.target.value)} className="cursor-pointer rounded-full bg-transparent py-2 pr-1 outline-none">
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} disabled={!l.code.startsWith("en") && !voice.canTranslate}>
                  {l.native}
                  {!l.code.startsWith("en") && !voice.canTranslate ? " (needs AI)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button variant="glassOchre" className="min-h-11" onClick={() => (tour >= 0 ? (setTour(-1), stop(), setHighlight(null)) : (setTab("parts"), setTour(0)))} disabled={phase !== "lab"}>
            {tour >= 0 ? <Pause /> : <Play />} {tour >= 0 ? "Stop tour" : "Guided tour"}
          </Button>
          <Button variant="ghost" size="round" className="min-h-11 min-w-11" onClick={onNew} aria-label="Close this lab" title="Close this lab">
            <X />
          </Button>
        </div>
      </div>

      {/*
        Desktop: the whole lab fits the window and only the side panel scrolls, so the model never leaves sight.
        Phone: the 3D view stays pinned under the header while the controls scroll beneath it.
      */}
      <div className="grid gap-4 lg:h-[calc(100dvh-15.5rem)] lg:min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* 3D stage */}
        <div
          className="glass-panel sticky top-[4.5rem] z-10 h-[44dvh] min-h-[16rem] overflow-hidden rounded-[2rem] bg-background bg-gradient-to-b from-white/40 to-sky/20 lg:relative lg:top-0 lg:z-0 lg:h-full"
        >
          <Suspense
            fallback={
              <div className="grid h-full place-items-center bg-gradient-to-r from-white/20 via-white/70 to-white/20 animate-shimmer">
                <div className="flex flex-col items-center gap-2">
                  <BubblingFlask />
                  <p className="text-sm font-bold text-ink/60">Getting your lab ready…</p>
                </div>
              </div>
            }
          >
            <LabCanvas
              spec={spec}
              values={values}
              ticks={ticks}
              highlight={highlight}
              onSelect={selectPart}
              popup={{ seg: analysis.segmentation, aspect: analysis.segmentation.aspect, imageUrl }}
              partNames={partNames}
              runKey={runKey}
              camera={camera}
              onPhase={setPhase}
            />
          </Suspense>
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2">
            <span className={cn("glass-panel rounded-full px-3 py-1 text-xs font-bold text-ink transition-opacity", phase === "materialize" && !isPopup ? "opacity-100" : "opacity-0")}>
              <Wand2 className="mr-1 inline size-3.5 text-blush-deep" /> Materializing your diagram…
            </span>
          </div>
          <div className="absolute right-3 top-3">
            <SourceCard imageUrl={imageUrl} spec={spec} highlight={highlight} />
          </div>
          {toast && (
            <div key={toast.id} role="status" className="animate-card-pop pointer-events-none absolute left-1/2 top-4 z-20 flex max-w-[88%] -translate-x-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-sky-deep to-blush-deep px-4 py-2 text-sm font-extrabold text-white shadow-lg">
              <Target className="size-4 shrink-0" /> <span className="truncate">Mission complete: {toast.goal}</span>
            </div>
          )}
          <BuddyCorner
            line={line}
            mood={mood}
            speaking={voice.speaking && voiceOn}
            open={bubbleOpen}
            onOpen={() => setBubbleOpen(true)}
            onClose={() => setBubbleOpen(false)}
            onRepeat={() => line && voiceOn && void speak(line.text, undefined, { translated: line.localized })}
          />
          <Button variant="glass" size="round" className="absolute bottom-3 right-3 z-10 size-11 min-h-11" onClick={() => cam({ kind: "reset" })} aria-label="Reset the view" title="Reset the view">
            <LocateFixed />
          </Button>
        </div>

        {/* Side panel */}
        <div className="glass-panel thin-scroll flex flex-col rounded-[2rem] p-4 md:p-5 lg:h-full lg:overflow-y-auto lg:overscroll-contain">
          <details className="group rounded-2xl bg-white/45 px-3 py-2 text-xs font-semibold text-ink/60">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-bold text-ink/70">
              <Info className="size-3.5" /> How this lab was made
            </summary>
            <p className="mt-1.5">{analysis.note}</p>
          </details>

          {isPopup && (
            <div className="mt-3 rounded-2xl bg-ochre/40 p-3">
              <p className="flex items-center gap-1.5 font-display text-sm font-extrabold text-ink">
                <Sparkles className="size-4" /> What does this diagram show?
              </p>
              <p className="mt-1 text-xs font-semibold text-ink/65">Pick one to turn your diagram into a working simulation.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TEMPLATE_LIST.map((t) => (
                  <button key={t.id} onClick={() => onPickTemplate(t.id)} className={cn("glass-convex min-h-9 rounded-full px-3 py-1 text-xs font-bold", t.tint)}>
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div role="tablist" aria-label="Lab panels" className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-white/50 p-1">
            {(
              [
                { id: "controls", label: "Experiment", icon: FlaskConical },
                { id: "parts", label: `Parts (${spec.parts.length})`, icon: Microscope },
                { id: "ask", label: "Ask", icon: MessageCircleQuestion },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-full font-display text-sm font-bold transition-all", tab === t.id ? "tube-fill liq-sky" : "text-ink/55 hover:text-ink")}
              >
                <t.icon className="size-4" /> {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex-1">
            {tab === "controls" && (
              <div className="mb-5">
                <MissionsPanel missions={missions} justDone={justDone} next={nextLabs} onOpenLab={(id) => onOpenSample(id as TemplateDef["id"])} onUpload={onNew} />
              </div>
            )}
            {tab === "controls" && (
              <ControlsPanel
                spec={spec}
                values={values}
                readout={readout}
                actions={actionsFor(spec)}
                onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))}
                onAction={(id) => setTicks((t) => ({ ...t, [id]: (t[id] ?? 0) + 1 }))}
              />
            )}
            {tab === "parts" && (
              <PartsPanel
                spec={spec}
                highlight={highlight}
                onSelect={selectPart}
                onRename={spec.source === "demo" && spec.template === "generic" ? (id, name) => setSpec((s) => ({ ...s, parts: s.parts.map((p) => (p.id === id ? { ...p, name } : p)) })) : undefined}
              />
            )}
            {tab === "ask" && <AskPanel spec={spec} messages={messages} busy={busy} onAsk={(q) => void ask(q)} />}
          </div>
        </div>
      </div>
    </div>
  );
}
