import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEMPLATE_LIST } from "./templates";

/**
 * The shared component & simulation registry: the one list of templates, part ids, parameter ranges
 * and equations that both the 3D frontend and the FastAPI backend use.
 * Regenerate after changing templates.ts:  npm run registry
 */
export function buildRegistry() {
  return {
    $comment: "Generated from src/labs/templates.ts by `npm run registry`. Do not edit by hand.",
    templates: TEMPLATE_LIST.map((t) => ({
      id: t.id,
      subject: t.subject,
      title: t.title,
      concept: t.concept,
      summary: t.blurb,
      parts: t.parts.map((p) => ({ id: p.id, name: p.name, short: p.short })),
      params: t.params.map((p) => ({ id: p.id, label: p.label, unit: p.unit ?? null, min: p.min, max: p.max, step: p.step, value: p.value, kind: p.kind ?? "slider" })),
      actions: t.actions,
      equations: t.equations,
      keywords: t.keywords,
    })),
  };
}

const FILE = path.resolve(__dirname, "../../shared/registry.json");

describe("shared registry", () => {
  it("backend copy matches the frontend templates", () => {
    const fresh = JSON.stringify(buildRegistry(), null, 2) + "\n";
    if (process.env.UPDATE_REGISTRY) writeFileSync(FILE, fresh);
    expect(readFileSync(FILE, "utf8")).toBe(fresh);
  });
});
