import { ArrowDown, Camera, Clipboard, ImageUp, MessageCircleQuestion, MoveRight, Rotate3d, ScanLine } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { SampleThumb } from "@/components/studio/SampleThumb";
import { Button } from "@/components/ui/Button";
import { TEMPLATE_LIST, type TemplateDef } from "@/labs/templates";
import { fileToDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";

const HeroScene = lazy(() => import("./HeroScene"));

const SUBJECT_TINT = { physics: "tint-sky", biology: "tint-ochre", chemistry: "tint-blush" } as const;

const STEPS = [
  { icon: ScanLine, title: "Snap or upload", body: "Any diagram from any chapter." },
  { icon: Rotate3d, title: "Watch it come alive", body: "It rises off the page as a 3D model." },
  { icon: MessageCircleQuestion, title: "Experiment & ask", body: "Change things, see why, ask anything." },
];

export interface PickedImage {
  dataUrl: string;
  name: string;
}

/** The front door: one obvious way in (upload / photo / paste / drop) and one-tap sample labs. */
export function Hero({ onImage, onSample }: { onImage: (img: PickedImage) => void; onSample: (id: TemplateDef["id"]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    try {
      onImage({ dataUrl: await fileToDataUrl(file), name: file.name || "photo.jpg" });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Paste a screenshot anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) void take(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  return (
    <section
      id="top"
      className="relative px-4 pb-14 pt-28 md:px-8 md:pt-32"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void take(e.dataTransfer.files[0]);
      }}
    >
      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-[2.5rem] border-4 border-dashed border-sky-deep bg-sky/40 backdrop-blur-sm">
          <p className="font-display text-3xl font-extrabold text-ink">Drop your diagram here</p>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="min-w-0">
          <span className="glass-panel inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-sky-deep">
            <span className="size-2 rounded-full bg-blush-deep" /> Your science textbook, in 3D
          </span>
          <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,4.6rem)] font-extrabold leading-[1.02] text-ink">
            Turn any textbook diagram into a <span className="text-gradient-title">3D lab</span> you can play with
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/75 md:text-xl">
            Snap a diagram from any chapter. Paper2Lab builds a moving model you can turn, test and ask questions about, in your own language.
          </p>

          {/* On phones the camera comes first: that's how students there will use it. */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button variant="glassBlush" size="lg" className="order-2 min-h-14 w-full px-8 text-lg sm:order-1 sm:w-auto" onClick={() => fileInput.current?.click()}>
              <ImageUp className="!size-5" /> Upload a diagram
            </Button>
            <Button variant="glassSky" size="lg" className="order-1 min-h-14 w-full px-7 text-lg sm:order-2 sm:w-auto" onClick={() => cameraInput.current?.click()}>
              <Camera className="!size-5" /> Take a photo
            </Button>
          </div>
          <p className="mt-3 hidden items-center gap-1.5 text-sm font-semibold text-ink/60 sm:flex">
            <Clipboard className="size-4" /> You can also drop an image here or paste a screenshot.
          </p>
          {error && <p className="mt-3 inline-block rounded-xl bg-blush/70 px-3 py-2 text-sm font-bold text-ink">{error}</p>}
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => void take(e.target.files?.[0])} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void take(e.target.files?.[0])} />

          <div className="mt-9">
            <p className="text-sm font-extrabold text-ink/70">No diagram handy? Start with one of these:</p>
            <div className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {TEMPLATE_LIST.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSample(t.id)}
                  className={cn("glass-convex flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-bold", SUBJECT_TINT[t.subject])}
                >
                  <SampleThumb id={t.id} className="h-8 w-11 rounded-full bg-white object-cover" />
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Before → after */}
        <div className="relative">
          <div className="glass-panel relative aspect-[5/4] overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-white/50 to-sky/30">
            <Suspense fallback={null}>
              <HeroScene />
            </Suspense>
            <span className="absolute right-5 top-5 rounded-full bg-white/80 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-sky-deep">● Live 3D lab</span>
          </div>
          <div className="animate-float-soft absolute -bottom-6 -left-2 w-32 rotate-[-6deg] sm:w-40 md:-left-8 md:w-52">
            <div className="glass-panel rounded-2xl p-2">
              <SampleThumb id="pulley-incline" className="block h-auto w-full rounded-xl bg-white" />
              <p className="px-1 pt-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink/60">Textbook page</p>
            </div>
            <MoveRight className="absolute -right-9 top-1/2 size-7 -translate-y-1/2 text-blush-deep" aria-hidden />
          </div>
        </div>
      </div>

      <ol className="mx-auto mt-16 grid max-w-7xl gap-3 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="glass-panel flex items-center gap-4 rounded-3xl p-4">
            <span className={cn("glass-convex grid size-12 shrink-0 place-items-center rounded-2xl", ["tint-sky", "tint-ochre", "tint-blush"][i])}>
              <s.icon className="size-6" />
            </span>
            <div>
              <p className="font-display text-lg font-extrabold text-ink">
                <span className="mr-1.5 text-ink/35">{i + 1}</span>
                {s.title}
              </p>
              <p className="text-sm text-ink/65">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex justify-center">
        <a href="#story" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-ink/60 hover:bg-white/60 hover:text-ink">
          See how it works <ArrowDown className="size-4" />
        </a>
      </div>
    </section>
  );
}
