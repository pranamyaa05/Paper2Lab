import { ArrowDown, Volume2, VolumeX } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { STORY_STEPS } from "@/content/story";
import { TEMPLATES } from "@/labs/templates";
import { useVoice } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";
import { Flashcard } from "./Flashcard";

const StoryCanvas = lazy(() => import("./StoryCanvas"));

const STAGE_START = [0, 0.12, 0.32, 0.48, 0.62, 0.8];
const TOUR = ["incline", "blockM", "pulley", "blockm"] as const;

function stageOf(p: number) {
  let s = 0;
  STAGE_START.forEach((b, i) => {
    if (p >= b) s = i;
  });
  return s;
}

export function StorySection() {
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [stage, setStage] = useState(0);
  const [hi, setHi] = useState(-1);
  const [viewfinder, setViewfinder] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const prevStage = useRef(0);
  const voice = useVoice();

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = section.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
      progress.current = p;
      setStage(stageOf(p));
      setViewfinder(p >= 0.36 && p < 0.49);
      setHi(p >= 0.8 ? Math.min(TOUR.length - 1, Math.floor(((p - 0.8) / 0.2) * TOUR.length)) : -1);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (stage === 3 && prevStage.current < 3) setFlashKey((k) => k + 1);
    prevStage.current = stage;
  }, [stage]);

  const highlight = hi >= 0 ? TOUR[hi]! : null;
  const component = highlight ? TEMPLATES["pulley-incline"].parts.find((c) => c.id === highlight) : undefined;

  // Narrate the current step (or highlighted part) while the voice guide is on.
  const { speak, stop } = voice;
  useEffect(() => {
    if (!voiceOn) return;
    void speak(component ? component.narration : STORY_STEPS[stage]!.narration);
  }, [voiceOn, stage, component, speak]);
  useEffect(() => {
    if (!voiceOn) stop();
  }, [voiceOn, stop]);

  const step = STORY_STEPS[stage]!;

  return (
    <section id="story" ref={section} className="relative h-[520vh] scroll-mt-0" aria-label="How Paper2Lab turns a diagram into a lab">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Suspense fallback={null}>
          <StoryCanvas progress={progress} highlight={highlight} />
        </Suspense>

        {/* Section intro (the page's own hero is above, so this one is a heading, not a logo) */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-[15vh] flex flex-col items-center px-4 text-center transition-all duration-700",
            stage === 0 ? "opacity-100" : "-translate-y-10 opacity-0",
          )}
        >
          <span className="glass-panel mb-4 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-sky-deep">How it works</span>
          <h2 className="max-w-3xl font-display text-[clamp(2.2rem,5.5vw,4.2rem)] font-extrabold leading-[1.05] text-ink">
            From a still picture to a <span className="text-gradient-title">working lab</span>
          </h2>
          <p className="mt-4 max-w-xl text-lg font-semibold text-ink/65">Scroll to watch one diagram come alive, step by step.</p>
        </div>
        <div
          className={cn(
            "absolute inset-x-0 bottom-8 flex flex-wrap items-center justify-center gap-3 transition-opacity duration-500",
            stage === 0 ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <a href="#story-start" className="glass-convex tint-ochre animate-float-soft flex min-h-11 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold">
            Scroll to open the book <ArrowDown className="size-4" />
          </a>
          <a href="#under-the-hood" className="flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-ink/60 hover:bg-white/60 hover:text-ink">
            Skip this
          </a>
        </div>

        {/* Camera viewfinder */}
        <div className={cn("pointer-events-none absolute inset-0 transition-opacity duration-500", viewfinder ? "opacity-100" : "opacity-0")}>
          <div className="absolute left-1/2 top-1/2 h-[min(62vh,30rem)] w-[min(86vw,26rem)] -translate-x-1/2 -translate-y-1/2">
            <span className="viewfinder-corner left-0 top-0 rounded-tl-2xl border-l-4 border-t-4" />
            <span className="viewfinder-corner right-0 top-0 rounded-tr-2xl border-r-4 border-t-4" />
            <span className="viewfinder-corner bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4" />
            <span className="viewfinder-corner bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4" />
            <span className="animate-focus-pulse absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-ochre" />
            <span className="glass-panel absolute -top-12 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-ink">
              <span className="text-blush-deep">●</span> Focusing on diagram…
            </span>
          </div>
        </div>

        {/* Shutter flash */}
        {flashKey > 0 && <div key={flashKey} className="animate-camera-flash pointer-events-none absolute inset-0 z-30 bg-flash" />}

        {/* Flashcard */}
        {stage === 3 && (
          <div className="absolute bottom-6 right-1/2 z-20 translate-x-1/2 md:bottom-auto md:right-[6vw] md:top-1/2 md:translate-x-0 md:-translate-y-1/2">
            <Flashcard />
          </div>
        )}

        {/* Step caption */}
        {stage > 0 && (
          <div
            key={`${stage}-${highlight ?? ""}`}
            className={cn(
              "animate-caption-in glass-panel absolute left-4 right-4 z-10 rounded-3xl p-5 md:left-[6vw] md:right-auto md:top-1/2 md:w-[24rem] md:-translate-y-1/2 md:p-7",
              stage === 3 ? "top-20 md:top-1/2" : "bottom-6 md:bottom-auto",
            )}
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-deep">{step.kicker}</p>
            <h2 className="mt-1 text-2xl font-extrabold text-ink md:text-4xl">{component ? component.name : step.title}</h2>
            <p className="mt-2 text-base leading-relaxed text-ink/70">{component ? component.narration : step.body}</p>
            {stage === 4 && (
              <p className="mt-4 inline-block rounded-xl bg-secondary px-3 py-2 font-mono text-xs text-ink md:text-sm">
                a = g(m − M sinθ − μM cosθ) / (M + m)
              </p>
            )}
            {stage === 5 && (
              <LinkButton href="#top" variant="glassBlush" size="pill" className="mt-4 pointer-events-auto">
                Try it with your own diagram
              </LinkButton>
            )}
          </div>
        )}

        {/* Voice + progress rail */}
        <div className="absolute right-4 top-20 z-20 flex flex-col items-center gap-3 md:right-6 md:top-1/2 md:-translate-y-1/2">
          <Button
            variant={voiceOn ? "glassBlush" : "glass"}
            size="round"
            onClick={() => setVoiceOn((v) => !v)}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Turn voice guide off" : "Turn voice guide on"}
            title={voiceOn ? "Voice guide on" : "Voice guide off"}
          >
            {voiceOn ? <Volume2 /> : <VolumeX />}
          </Button>
          <div className="glass-panel hidden flex-col gap-2 rounded-full p-2 md:flex">
            {STAGE_START.map((_, i) => (
              <span key={i} className={cn("size-2.5 rounded-full transition-all", i <= stage ? "bg-sky-deep" : "bg-border", i === stage && "scale-150 bg-blush-deep")} />
            ))}
          </div>
        </div>
      </div>
      <span id="story-start" className="absolute left-0 top-[100vh]" aria-hidden />
    </section>
  );
}
