import { RotateCcw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sampleDataUrl } from "@/components/three/samples2d";
import { Button } from "@/components/ui/Button";
import { useVoice } from "@/hooks/use-voice";
import { specFromTemplate, TEMPLATES, type TemplateDef } from "@/labs/templates";
import { analyzeDiagram, type Analysis, type DiagramInput } from "@/lib/analyze";
import { getStatus } from "@/lib/api";
import { AnalyzingCard } from "./AnalyzingCard";
import { LabView } from "./LabView";

export type StudioRequest =
  | { kind: "sample"; sampleId: TemplateDef["id"]; nonce: number }
  | { kind: "image"; dataUrl: string; name: string; nonce: number };

function errorText(e: unknown) {
  const msg = (e as Error)?.message ?? String(e);
  try {
    return (JSON.parse(msg) as { error?: string; detail?: string }).detail ?? (JSON.parse(msg) as { error?: string }).error ?? msg;
  } catch {
    return msg;
  }
}

/**
 * The workspace: analyse → materialize → experiment. It stays out of the way until a student
 * picks a diagram (from the hero or a lab card), then opens right under the hero.
 */
export function Studio({ request, onClose }: { request: StudioRequest | null; onClose: () => void }) {
  const [input, setInput] = useState<DiagramInput | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const voice = useVoice();
  const abort = useRef<AbortController | null>(null);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    void getStatus().then((s) => setAi(s.gemini));
  }, []);

  const run = useCallback(async (next: DiagramInput) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setInput(next);
    setAnalysis(null);
    setError(null);
    requestAnimationFrame(() => section.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    const started = performance.now();
    try {
      const result = await analyzeDiagram(next, ctrl.signal);
      // Let the scanning animation play for a moment, even when analysis is instant.
      await new Promise((r) => setTimeout(r, Math.max(0, 1900 - (performance.now() - started))));
      if (!ctrl.signal.aborted) setAnalysis(result);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(errorText(e));
      setInput(null);
    }
  }, []);

  useEffect(() => {
    if (!request) return;
    if (request.kind === "sample") void run({ dataUrl: sampleDataUrl(request.sampleId), name: `${TEMPLATES[request.sampleId].title}.png`, sampleId: request.sampleId });
    else void run({ dataUrl: request.dataUrl, name: request.name });
  }, [request, run]);

  const pickTemplate = (id: TemplateDef["id"]) => {
    if (!analysis) return;
    setAnalysis({ ...analysis, spec: specFromTemplate(id, "manual"), note: `You said this shows ${TEMPLATES[id].title.toLowerCase()}, so I loaded that lab.` });
  };

  const openSample = (id: TemplateDef["id"]) => void run({ dataUrl: sampleDataUrl(id), name: `${TEMPLATES[id].title}.png`, sampleId: id });

  const close = () => {
    abort.current?.abort();
    voice.stop();
    setInput(null);
    setAnalysis(null);
    setError(null);
    onClose();
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
  };

  if (!input && !error) return null;

  return (
    <section id="lab" ref={section} aria-label="Your lab" className="relative scroll-mt-24 px-4 pb-16 pt-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        {error && (
          <div role="alert" className="glass-panel flex flex-wrap items-center gap-4 rounded-3xl p-5">
            <TriangleAlert className="size-6 text-blush-deep" />
            <p className="flex-1 font-semibold text-ink">{error}</p>
            <Button variant="glassSky" onClick={close}>
              <RotateCcw /> Try another diagram
            </Button>
          </div>
        )}
        {input && !analysis && <AnalyzingCard imageUrl={input.dataUrl} name={input.name} ai={ai && !input.sampleId} />}
        {input && analysis && <LabView analysis={analysis} imageUrl={input.dataUrl} voice={voice} onPickTemplate={pickTemplate} onOpenSample={openSample} onNew={close} />}
      </div>
    </section>
  );
}
