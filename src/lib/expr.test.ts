import { describe, expect, it } from "vitest";
import { compile, safeCompile } from "./expr";

describe("formula evaluator", () => {
  it("does arithmetic with precedence", () => {
    expect(compile("1 + 2 * 3 ^ 2")({})).toBe(19);
    expect(compile("(1 + 2) * 3")({})).toBe(9);
    expect(compile("-2 ^ 2")({})).toBe(-4);
  });
  it("reads variables and functions", () => {
    expect(compile("sqrt(g / L)")({ g: 9.8, L: 2.45 })).toBeCloseTo(2, 9);
    expect(compile("max(a, b, 3)")({ a: 1, b: 5 })).toBe(5);
    expect(compile("2 * pi")({})).toBeCloseTo(Math.PI * 2, 9);
  });
  it("treats unknown variables as zero", () => {
    expect(compile("x + 1")({})).toBe(1);
  });
  it("refuses code", () => {
    expect(() => compile("alert(1)")).toThrow();
    expect(() => compile("a; b")).toThrow();
    expect(() => compile("constructor.constructor('x')()")).toThrow();
    expect(safeCompile("window.location", 7)({})).toBe(7);
  });
  it("never returns NaN or Infinity", () => {
    expect(compile("1 / 0")({})).toBe(0);
    expect(compile("sqrt(-1)")({})).toBe(0);
  });
});
