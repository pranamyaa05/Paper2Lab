/**
 * A tiny, safe arithmetic evaluator for AI-generated motion formulas such as "current * field * 2".
 * Supports numbers, variables, + − * / ^, parentheses, unary minus and a fixed set of Math functions.
 * Never uses eval or Function, so a formula from the AI cannot run code.
 */
const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  exp: Math.exp,
  log: Math.log,
  floor: Math.floor,
  sign: Math.sign,
  clamp: (x, lo, hi) => Math.min(hi ?? 1, Math.max(lo ?? 0, x ?? 0)),
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`Bad number at ${i}`);
      out.push({ t: "num", v: parseFloat(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
    } else if ("+-*/^(),".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else {
      throw new Error(`Unexpected "${c}"`);
    }
  }
  return out;
}

export type Compiled = (vars: Record<string, number>) => number;

export function compile(src: string): Compiled {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const eat = (v?: string) => {
    const t = toks[pos];
    if (!t || (v !== undefined && t.v !== v)) throw new Error(`Expected ${v ?? "token"}`);
    pos++;
    return t;
  };
  type Node = (vars: Record<string, number>) => number;

  function primary(): Node {
    const t = eat();
    if (t.t === "num") return () => t.v;
    if (t.t === "op" && t.v === "(") {
      const e = expr();
      eat(")");
      return e;
    }
    if (t.t === "op" && t.v === "-") {
      const e = power();
      return (v) => -e(v);
    }
    if (t.t === "op" && t.v === "+") return power();
    if (t.t === "id") {
      const name = t.v;
      const nx = peek();
      if (nx && nx.t === "op" && nx.v === "(") {
        const fn = FUNCS[name.toLowerCase()];
        if (!fn) throw new Error(`Unknown function ${name}`);
        eat("(");
        const args: Node[] = [];
        const close = peek();
        if (!(close && close.t === "op" && close.v === ")")) {
          args.push(expr());
          while (peek()?.v === ",") {
            eat(",");
            args.push(expr());
          }
        }
        eat(")");
        return (v) => fn(...args.map((a) => a(v)));
      }
      const k = CONSTS[name.toLowerCase()];
      if (k !== undefined) return () => k;
      return (v) => v[name] ?? 0;
    }
    throw new Error(`Unexpected ${t.v}`);
  }
  function power(): Node {
    const base = primary();
    if (peek()?.v === "^") {
      eat("^");
      const exp = power();
      return (v) => Math.pow(base(v), exp(v));
    }
    return base;
  }
  function term(): Node {
    let left = power();
    while (peek()?.v === "*" || peek()?.v === "/") {
      const op = eat().v;
      const right = power();
      const l = left;
      left = op === "*" ? (v) => l(v) * right(v) : (v) => l(v) / right(v);
    }
    return left;
  }
  function expr(): Node {
    let left = term();
    while (peek()?.v === "+" || peek()?.v === "-") {
      const op = eat().v;
      const right = term();
      const l = left;
      left = op === "+" ? (v) => l(v) + right(v) : (v) => l(v) - right(v);
    }
    return left;
  }
  const root = expr();
  if (pos !== toks.length) throw new Error("Unexpected trailing input");
  return (vars) => {
    const r = root(vars);
    return Number.isFinite(r) ? r : 0;
  };
}

/** Compile, falling back to a constant when the formula is invalid. */
export function safeCompile(src: string | number | undefined, fallback = 0): Compiled {
  if (typeof src === "number") return () => src;
  if (!src) return () => fallback;
  try {
    return compile(src);
  } catch {
    return () => fallback;
  }
}
