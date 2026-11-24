import { guessTemplate, specFromTemplate, TEMPLATES, type TemplateDef } from "@/labs/templates";
import { z } from "zod";
import { LabSpecSchema, TEMPLATE_IDS, type LabSpec, type PartSpec } from "@/labs/types";
import { getStatus, postJson } from "@/lib/api";
import { shrinkImage } from "@/lib/image";
import { segmentImage, type Segmentation } from "./segment";

export interface DiagramInput {
  dataUrl: string;
  name: string;
  /** Set for the built-in sample diagrams, whose concept is already known. */
  sampleId?: TemplateDef["id"];
}

export interface Analysis {
  spec: LabSpec;
  segmentation: Segmentation & { aspect: number };
  mode: "ai" | "demo" | "sample";
  /** A plain-language note on how the concept was decided. */
  note: string;
}

/** Build a demo lab from the colour regions alone: a 3D pop-up of the diagram with one part per region. */
export function popupSpec(seg: Segmentation, name: string): LabSpec {
  const parts: PartSpec[] = seg.regions.map((r) => ({
    id: `region-${r.index}`,
    name: r.name,
    short: r.ink ? "Lines, arrows and text" : `${Math.max(1, Math.round(r.area * 100))}% of the diagram`,
    narration: r.ink
      ? "These are the outlines, arrows and labels from the drawing, raised just above the page."
      : `This ${r.name.toLowerCase()} covers about ${Math.max(1, Math.round(r.area * 100))} percent of the diagram. Without an AI key I can't tell what it is yet, but you can rename it or pick the matching concept.`,
    bbox: r.bbox,
    color: r.color,
  }));
  const title = name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Your diagram";
  return {
    template: "generic",
    subject: "physics",
    title: title.charAt(0).toUpperCase() + title.slice(1),
    concept: "3D pop-up of your diagram",
    summary: "Every coloured part of the drawing, lifted into 3D. Pick what the diagram shows to turn it into a live simulation.",
    intro: `I've lifted your diagram into 3D and found ${parts.length} parts. Tap any part to inspect it, or tell me what the diagram shows so I can build the right simulation.`,
    params: [
      { id: "explode", label: "Pull layers apart", min: 0, max: 1, step: 0.01, value: 0.25 },
      { id: "depth", label: "Depth", min: 0.2, max: 2, step: 0.05, value: 1 },
      { id: "spin", label: "Turntable", min: 0, max: 1, step: 1, value: 0, kind: "toggle" },
    ],
    parts,
    equations: [],
    source: "demo",
  };
}

/**
 * The short reply the AI gives when a diagram matches a built-in template: just the id, where each part
 * is, and any values printed on the diagram. Names and narration already live in the template, so the
 * AI doesn't spend output tokens repeating them.
 */
const TemplateHitSchema = z.object({
  template: z.enum(TEMPLATE_IDS).exclude(["generic"]),
  title: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  parts: z.array(z.object({ id: z.string(), bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional() })).default([]),
  params: z.array(z.object({ id: z.string(), value: z.number() })).default([]),
});
type TemplateHit = z.infer<typeof TemplateHitSchema>;

/** Merge what the AI saw (title, part boxes, printed values) into a validated template so the physics stays correct. */
function mergeIntoTemplate(ai: TemplateHit): LabSpec {
  const base = specFromTemplate(ai.template, "ai");
  const aiParts = new Map(ai.parts.map((p) => [p.id, p]));
  base.parts = base.parts.map((p) => ({ ...p, bbox: aiParts.get(p.id)?.bbox ?? p.bbox }));
  // Start the sliders from the values the AI read off the diagram, kept inside the safe ranges.
  base.params = base.params.map((p) => {
    const v = ai.params.find((q) => q.id === p.id)?.value;
    return v === undefined ? p : { ...p, value: Math.min(p.max, Math.max(p.min, v)) };
  });
  if (ai.title) base.title = ai.title;
  if (ai.summary) base.summary = ai.summary;
  base.confidence = ai.confidence;
  return base;
}

export async function analyzeDiagram(input: DiagramInput, signal?: AbortSignal): Promise<Analysis> {
  const segmentation = await segmentImage(input.dataUrl);
  if (input.sampleId) {
    return { spec: specFromTemplate(input.sampleId, "sample"), segmentation, mode: "sample", note: `Sample diagram: ${TEMPLATES[input.sampleId].title}.` };
  }

  const status = await getStatus();
  // Why the on-device fallback is being used, shown to the student.
  let reason = "no AI key";
  if (status.gemini) {
    try {
      // A 768 px JPEG is all the model needs to read a diagram, and costs a fraction of a full photo.
      const small = await shrinkImage(input.dataUrl, 768);
      // Backend pipeline: vision agent → scientific reasoning & validation → simulation orchestrator.
      const plan = await postJson<{ mode: "template" | "generic" | "none"; spec: unknown; note: string }>(
        "/api/v1/diagram/analyze",
        { image: small.split(",")[1], mime: "image/jpeg" },
        signal,
      );
      if (plan.mode === "template") {
        const hit = TemplateHitSchema.safeParse(plan.spec);
        if (hit.success) return { spec: mergeIntoTemplate(hit.data), segmentation, mode: "ai", note: plan.note };
      } else if (plan.mode === "generic") {
        const parsed = LabSpecSchema.safeParse(plan.spec);
        if (parsed.success) return { spec: { ...parsed.data, source: "ai" }, segmentation, mode: "ai", note: plan.note };
      }
      // The validation engine rejected the AI's reading: show the diagram's own 3D pop-up instead.
      return { spec: popupSpec(segmentation, input.name), segmentation, mode: "demo", note: plan.note };
    } catch (e) {
      if (signal?.aborted) throw e;
      // Never dead-end the student: fall back to on-device analysis.
      reason = /busy|503|high demand|timed out/i.test((e as Error).message) ? "Gemini is busy right now" : "Gemini couldn't read this one";
    }
  }

  const guess = guessTemplate(input.name);
  if (guess) {
    return {
      spec: specFromTemplate(guess.id, "demo"),
      segmentation,
      mode: "demo",
      note: `On-device mode (${reason}): matched "${TEMPLATES[guess.id].title}" from the file name.`,
    };
  }
  return {
    spec: popupSpec(segmentation, input.name),
    segmentation,
    mode: "demo",
    note: `On-device mode (${reason}): I lifted the diagram's colour regions into 3D. Pick what it shows to get a live simulation${status.gemini ? ", or try again in a minute" : ""}.`,
  };
}
