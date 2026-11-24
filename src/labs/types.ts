import { z } from "zod";

export const SUBJECTS = ["physics", "biology", "chemistry"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const TEMPLATE_IDS = ["pulley-incline", "dc-motor", "neuron", "animal-cell", "phenolphthalein", "electrolysis", "generic"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const formula = z.union([z.string().max(200), z.number()]);

export const ParamSchema = z.object({
  id: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  label: z.string(),
  unit: z.string().optional(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  value: z.number(),
  kind: z.enum(["slider", "toggle"]).optional(),
});
export type ParamSpec = z.infer<typeof ParamSchema>;

export const PartSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string().default(""),
  narration: z.string().default(""),
  /** Where the part is in the uploaded image, as fractions [x, y, w, h]. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  color: z.string().optional(),
});
export type PartSpec = z.infer<typeof PartSchema>;

export const MotionSchema = z.object({
  type: z.enum(["spin", "oscillate", "slide", "pulse", "orbit", "flow"]),
  axis: z.enum(["x", "y", "z"]).default("y"),
  /** Formula over the lab's parameter ids and t (seconds). */
  speed: formula.default(1),
  amplitude: formula.default(0.3),
});
export type MotionSpec = z.infer<typeof MotionSchema>;

export const PrimitiveSchema = z.object({
  id: z.string(),
  part: z.string().optional(),
  shape: z.enum(["box", "sphere", "cylinder", "cone", "torus", "capsule", "arrow"]),
  position: vec3,
  size: vec3.default([1, 1, 1]),
  rotation: vec3.default([0, 0, 0]),
  color: z.string().default("#a9c6f7"),
  opacity: z.number().min(0).max(1).default(1),
  motion: MotionSchema.optional(),
});
export type PrimitiveSpec = z.infer<typeof PrimitiveSchema>;

export const ReadoutSchema = z.object({ label: z.string(), formula, unit: z.string().optional() });
export type ReadoutSpec = z.infer<typeof ReadoutSchema>;

export const LabSpecSchema = z.object({
  template: z.enum(TEMPLATE_IDS),
  subject: z.enum(SUBJECTS),
  title: z.string(),
  concept: z.string().default(""),
  summary: z.string().default(""),
  intro: z.string().default(""),
  params: z.array(ParamSchema).default([]),
  parts: z.array(PartSchema).default([]),
  equations: z.array(z.string()).default([]),
  /** Generic labs only: the 3D scene, built from simple shapes. */
  scene: z.array(PrimitiveSchema).max(80).optional(),
  /** Generic labs only: live numbers computed from parameters. */
  readouts: z.array(ReadoutSchema).max(6).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type LabSpec = z.infer<typeof LabSpecSchema> & {
  /** Where this spec came from. */
  source: "sample" | "ai" | "demo" | "manual";
};

export type ParamValues = Record<string, number>;

export interface Readout {
  headline: string;
  stats: { label: string; value: string }[];
}
