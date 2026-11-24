import { actionsFor, describeLab } from "@/labs/templates";
import type { LabSpec, ParamSpec, ParamValues } from "@/labs/types";
import { getStatus, postJson } from "./api";

/** What the tutor makes the 3D view do while it answers. */
export type TutorAction =
  | { type: "highlight"; part: string }
  | { type: "focus"; part: string }
  | { type: "set"; param: string; value: number }
  | { type: "trigger"; action: string }
  | { type: "rotate" };

export interface AskAnswer {
  answer: string;
  /** Ordered actions for the 3D view: highlight, focus the camera, change a slider, run a demo, rotate. */
  actions: TutorAction[];
  /** Part to light up while the answer is read out. */
  highlight?: string;
  /** Parameter changes that demonstrate the answer in the simulation. */
  set?: Record<string, number>;
  /** ai = Gemini; local = answered on this device because the rules were sure; demo = no AI key. */
  via: "ai" | "demo" | "local";
  /** True when the on-device rules found exactly what the question was about. */
  confident?: boolean;
}

/** Extra words students use for each parameter, beyond its label. */
const SYNONYMS: Record<string, string[]> = {
  M: ["block m on", "big block", "block on the slope", "heavier block", "block m "],
  m: ["hanging", "small block", "hanging mass", "weight"],
  theta: ["angle", "steeper", "steep", "slope angle", "incline angle", "flatter", "tilt"],
  mu: ["friction", "rough", "smooth", "slippery", "grip"],
  voltage: ["voltage", "volts", "battery", "power"],
  field: ["field", "magnet", "magnetic", "stronger magnet", "tesla"],
  turns: ["turns", "loops", "windings", "coil"],
  stimulus: ["stimulus", "signal", "stimulate", "input", "strength"],
  myelin: ["myelin", "insulation", "sheath"],
  diameter: ["diameter", "thicker", "wider", "thinner", "axon size"],
  pH: ["ph", "acid", "acidic", "base", "basic", "alkaline", "alkali"],
  conc: ["concentration", "electrolyte", "acid", "ions", "salt"],
  energy: ["energy", "atp", "respiration", "exercise", "demand"],
  secretion: ["export", "secretion", "protein", "shipping", "vesicles"],
  cutaway: ["cut", "slice", "open", "inside"],
  outside: ["salt", "salty", "sugar", "concentrated", "dilute", "pure water", "distilled", "tonicity", "hypotonic", "hypertonic", "osmosis", "solution"],
  explode: ["apart", "explode", "separate", "layers"],
  depth: ["depth", "thick", "height"],
  spin: ["spin", "rotate", "turntable"],
};

const UP = ["increase", "more", "higher", "bigger", "larger", "raise", "stronger", "heavier", "steeper", "faster", "double", "add", "up", "thicker", "wider", "rougher", "basic", "alkaline", "turn on"];
const DOWN = ["decrease", "less", "lower", "smaller", "reduce", "weaker", "lighter", "flatter", "slower", "half", "remove", "down", "thinner", "smoother", "no ", "without", "acidic", "turn off", "zero"];

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9µ° ]/g, " ");

function findParam(spec: LabSpec, q: string): ParamSpec | undefined {
  let best: { p: ParamSpec; score: number } | undefined;
  for (const p of spec.params) {
    const keys = [p.label.toLowerCase(), p.id.toLowerCase(), ...(SYNONYMS[p.id] ?? [])];
    const score = keys.reduce((s, k) => (q.includes(k.toLowerCase()) ? s + k.length : s), 0);
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p;
}

function findPart(spec: LabSpec, q: string) {
  let best: { id: string; score: number } | undefined;
  for (const part of spec.parts) {
    const name = part.name.toLowerCase().replace(/\(.*?\)/g, "");
    const tokens = name.split(/\s+/).filter((t) => t.length >= 4);
    let score = q.includes(name.trim()) ? 10 : 0;
    score += tokens.filter((t) => q.includes(t.replace(/s$/, ""))).length * 3;
    if (q.includes(part.id.toLowerCase())) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { id: part.id, score };
  }
  return best?.id;
}

const fmt = (n: number, p: ParamSpec) => `${Number.isInteger(p.step) ? Math.round(n) : n.toFixed(p.step < 0.1 ? 2 : 1)}${p.unit ? ` ${p.unit}` : ""}`;

const ROTATE = /\b(rotate|all sides|other side|from behind|turn it around|spin it around|360)\b/;

/** Turn a part and slider changes into the action list the 3D view runs. */
function toActions(a: Omit<AskAnswer, "actions">, q: string): TutorAction[] {
  const out: TutorAction[] = [];
  if (a.highlight) out.push({ type: "highlight", part: a.highlight }, { type: "focus", part: a.highlight });
  for (const [param, value] of Object.entries(a.set ?? {})) out.push({ type: "set", param, value });
  if (ROTATE.test(q)) out.push({ type: "rotate" });
  return out;
}

/** Rule-based tutor for demo mode: finds the part or parameter the question is about and acts on it. */
export function localAnswer(spec: LabSpec, values: ParamValues, question: string): AskAnswer {
  const q = ` ${words(question)} `;
  if (ROTATE.test(q) && !findPart(spec, q) && !findParam(spec, q)) {
    return { answer: "Here it is from every side. Drag the model any time to look around yourself.", actions: [{ type: "rotate" }], via: "demo", confident: true };
  }
  const a = localCore(spec, values, question);
  return { ...a, actions: toActions(a, q) };
}

function localCore(spec: LabSpec, values: ParamValues, question: string): Omit<AskAnswer, "actions"> {
  const q = ` ${words(question)} `;
  const param = findParam(spec, q);
  const partId = findPart(spec, q);
  const isChange = /what if|what happens|increase|decrease|more|less|double|half|set|make|change|without|remove|add|turn|higher|lower|steeper|stronger|weaker|heavier|lighter|to \d/.test(q);

  if (param && isChange) {
    const cur = values[param.id] ?? param.value;
    const num = /(?:to|=|at|of)\s*(-?\d+(?:\.\d+)?)/.exec(q) ?? /(-?\d+(?:\.\d+)?)\s*(?:kg|°|deg|degrees|a|amps|t|v|volts|mv|µm|um|%)?\s*$/.exec(q.trim());
    let next: number;
    if (param.kind === "toggle") {
      next = DOWN.some((w) => q.includes(w)) ? param.min : param.max;
    } else if (num) {
      next = parseFloat(num[1]!);
    } else if (q.includes("double")) {
      next = cur * 2;
    } else if (q.includes("half")) {
      next = cur / 2;
    } else {
      const ups = UP.filter((w) => q.includes(w)).length;
      const downs = DOWN.filter((w) => q.includes(w)).length;
      next = cur + (ups >= downs ? 1 : -1) * (param.max - param.min) * 0.25;
    }
    next = Math.min(param.max, Math.max(param.min, Math.round(next / param.step) * param.step));
    const before = describeLab(spec, values);
    const after = describeLab(spec, { ...values, [param.id]: next });
    const changes = after.stats
      .map((s, i) => ({ s, b: before.stats[i] }))
      .filter(({ s, b }) => b && b.value !== s.value)
      .slice(0, 3)
      .map(({ s, b }) => `${s.label} goes from ${b!.value} to ${s.value}`);
    const verb = param.kind === "toggle" ? (next >= 0.5 ? "switch on" : "switch off") : next > cur ? "raise" : next < cur ? "lower" : "keep";
    const what = param.kind === "toggle" ? param.label.toLowerCase() : `${param.label.toLowerCase()} from ${fmt(cur, param)} to ${fmt(next, param)}`;
    return {
      answer: `Let's try it: I'll ${verb} the ${what}. ${after.headline}${changes.length ? ` ${changes.join("; ")}.` : ""}`,
      set: { [param.id]: next },
      highlight: partId,
      via: "demo",
      confident: true,
    };
  }

  if (partId) {
    const part = spec.parts.find((p) => p.id === partId)!;
    // "What does X do?" is answered by the part's own narration; open questions that merely mention a part go to the AI.
    const simple = /^\s*(what|which|where|explain|describe|tell me|show me)\b/.test(q) && !/why|how come|what if|compare|difference|instead/.test(q);
    return { answer: part.narration || `${part.name}: ${part.short}.`, highlight: partId, via: "demo", confident: simple };
  }

  if (/why|how does|how do|explain|what is this|what's happening|what is happening/.test(q)) {
    const now = describeLab(spec, values);
    return {
      answer: `${spec.intro} Right now: ${now.headline}${spec.equations.length ? ` The key relation is ${spec.equations[0]}.` : ""}`,
      via: "demo",
    };
  }

  const exampleParam = spec.params[0];
  const examplePart = spec.parts[0];
  return {
    answer: `In demo mode I can explain any part or test a change. Try "what does the ${examplePart?.name.toLowerCase() ?? "first part"} do?"${exampleParam ? ` or "what if I increase the ${exampleParam.label.toLowerCase()}?"` : ""}. Add a Gemini key for open-ended questions.`,
    via: "demo",
  };
}

/** Ask the AI tutor when a key is set; otherwise answer with the local rules. */
export async function askDiagram(spec: LabSpec, values: ParamValues, question: string, language: string): Promise<AskAnswer> {
  const local = localAnswer(spec, values, question);
  const status = await getStatus();
  if (!status.gemini) return local;
  // Efficiency: anything the on-device rules are sure about never costs an AI request.
  if (local.confident) return { ...local, via: "local" };
  try {
    // Spatial tutor agent on the backend. It gets a snapshot of the live simulation, which runs here in the browser.
    const r = await postJson<{ answer?: string; actions?: TutorAction[] }>("/api/v1/tutor/ask", {
      question,
      language,
      lab: {
        title: spec.title,
        template: spec.template,
        equations: spec.equations,
        parts: spec.parts.map((p) => ({ id: p.id, name: p.name, short: p.short })),
        params: spec.params.map((p) => ({ id: p.id, label: p.label, unit: p.unit, min: p.min, max: p.max, value: values[p.id] ?? p.value })),
        actions: actionsFor(spec),
        readout: describeLab(spec, values),
      },
    });
    const actions = sanitizeActions(spec, r.actions ?? []);
    const set = Object.fromEntries(actions.flatMap((a) => (a.type === "set" ? [[a.param, a.value]] : [])));
    const highlight = actions.find((a): a is Extract<TutorAction, { type: "highlight" }> => a.type === "highlight")?.part;
    return { answer: r.answer ?? "I couldn't work that out. Try asking about one part.", actions, highlight, set, via: "ai" };
  } catch {
    return local;
  }
}

/** Keep only actions that refer to this lab's real parts, sliders and demonstrations, with values in range. */
export function sanitizeActions(spec: LabSpec, actions: TutorAction[]): TutorAction[] {
  const parts = new Set(spec.parts.map((p) => p.id));
  const demos = new Set(actionsFor(spec).map((a) => a.id));
  return actions.flatMap((a): TutorAction[] => {
    if ((a.type === "highlight" || a.type === "focus") && parts.has(a.part)) return [a];
    if (a.type === "trigger" && demos.has(a.action)) return [a];
    if (a.type === "rotate") return [a];
    if (a.type === "set") {
      const p = spec.params.find((x) => x.id === a.param);
      return p && Number.isFinite(a.value) ? [{ ...a, value: Math.min(p.max, Math.max(p.min, a.value)) }] : [];
    }
    return [];
  });
}
