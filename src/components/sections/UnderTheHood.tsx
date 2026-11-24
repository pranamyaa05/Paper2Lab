import { Brain, ChevronDown, Cpu, Cuboid, FlaskConical, Languages, MessagesSquare, ScanSearch, ShieldCheck, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { getStatus, type ApiStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const PIPELINE = [
  { icon: ScanSearch, title: "Vision agent", body: "Gemini reads the concept, every component, its labels and where each part sits in the picture." },
  { icon: ShieldCheck, title: "Reasoning & validation", body: "Every AI answer is checked: unknown parts dropped, values kept in tested ranges, formulas proven safe at every slider position." },
  { icon: Brain, title: "Simulation orchestrator", body: "Chooses a tested template, a validated AI-designed simulation, or an on-device 3D pop-up." },
  { icon: Cuboid, title: "Scientific engine", body: "Real equations run in the browser at 60 fps: Newton's laws, back-EMF, osmosis, Faraday's law and more." },
  { icon: MessagesSquare, title: "Spatial tutor", body: "Grounds each question on a 3D part and acts: highlight, fly the camera, change a slider, run a demo." },
  { icon: Languages, title: "Voice", body: "Narration in nine languages; translations are batched and cached." },
  { icon: FlaskConical, title: "Efficiency layer", body: "Caching, merged requests, lite-first routing and pacing keep a free API key within its daily quota." },
];

interface Usage {
  requests: number;
  cacheHits: number;
  coalesced: number;
  tokens: { input: number; output: number; thinking: number };
  cooling: string[];
}

const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** For teachers, judges and the curious: how the system works, and whether the AI is connected. */
export function UnderTheHood() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    void getStatus().then(setStatus);
  }, []);
  useEffect(() => {
    if (!open || !status?.gemini) return;
    const load = () =>
      fetch("/api/v1/usage")
        .then((r) => (r.ok ? (r.json() as Promise<Usage>) : null))
        .then(setUsage)
        .catch(() => {});
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [open, status?.gemini]);

  return (
    <section id="under-the-hood" className="scroll-mt-24 px-4 py-12 md:px-8">
      <div className="glass-panel mx-auto max-w-7xl rounded-[2rem]">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 p-6 text-left md:p-8">
          <span>
            <span className="block text-xs font-extrabold uppercase tracking-[0.2em] text-sky-deep">For teachers & judges</span>
            <span className="mt-1 block font-display text-2xl font-extrabold text-ink md:text-3xl">Under the hood</span>
          </span>
          <span className="flex items-center gap-3">
            {status && (
              <span className="hidden items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-ink/70 sm:flex">
                {status.gemini ? <Wifi className="size-3.5 text-sky-deep" /> : <Cpu className="size-3.5 text-ochre-deep" />}
                {status.gemini ? "AI connected" : "On-device mode"}
              </span>
            )}
            <ChevronDown className={cn("size-6 text-ink/60 transition-transform", open && "rotate-180")} />
          </span>
        </button>
        {open && (
          <div className="animate-caption-in px-6 pb-8 md:px-8">
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((s, i) => (
                <li key={s.title} className="rounded-2xl bg-white/60 p-4">
                  <s.icon className="size-5 text-sky-deep" />
                  <p className="mt-2 font-display font-extrabold text-ink">
                    <span className="mr-1 text-ink/35">{i + 1}</span> {s.title}
                  </p>
                  <p className="mt-1 text-sm text-ink/65">{s.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-ink/65">
              {status?.gemini
                ? `AI: Gemini via the FastAPI backend${status.elevenlabs ? " · ElevenLabs voice" : " · browser voice"}.`
                : "Running on this device: no AI key or backend, so diagrams are lifted into 3D from their colours and the tutor answers with built-in rules."}
              {usage && ` This session: ${usage.requests} AI calls, ${usage.cacheHits + usage.coalesced} saved by the cache, ${k(usage.tokens.input + usage.tokens.output + usage.tokens.thinking)} tokens${usage.cooling.length ? `; resting busy models: ${usage.cooling.join(", ")}` : ""}.`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
