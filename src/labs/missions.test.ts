import { describe, expect, it } from "vitest";
import { TEMPLATE_LIST } from "./templates";
import type { ParamValues } from "./types";

/** Every slider position (every step for short sliders, thinned for long ones), plus 0/1 for action counters like "reverse". */
function* settings(params: { id: string; min: number; max: number; step: number }[], i = 0, acc: ParamValues = {}): Generator<ParamValues> {
  if (i === params.length) {
    yield* [{ ...acc, reverse: 0 }, { ...acc, reverse: 1 }];
    return;
  }
  const p = params[i]!;
  const n = Math.round((p.max - p.min) / p.step);
  const stride = n <= 60 ? 1 : Math.ceil(n / 24);
  for (let k = 0; k <= n; k += stride) yield* settings(params, i + 1, { ...acc, [p.id]: +(p.min + k * p.step).toFixed(6) });
  yield* settings(params, i + 1, { ...acc, [p.id]: p.max });
}

describe("missions", () => {
  for (const t of TEMPLATE_LIST) {
    for (const m of t.missions) {
      it(`${t.title}: “${m.goal}” can be achieved`, () => {
        let found = false;
        for (const v of settings(t.params)) if (m.done(v)) (found = true);
        expect(found).toBe(true);
      });
    }
    it(`${t.title}: missions aren't all done at the start`, () => {
      const start = Object.fromEntries(t.params.map((p) => [p.id, p.value]));
      expect(t.missions.every((m) => m.done(start))).toBe(false);
    });
  }
});
