import { describe, expect, it } from "vitest";
import { segmentPixels } from "./segment";

/** White page with a red square, a blue circle and a black line. */
function synthetic(w = 60, h = 40) {
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  const set = (x: number, y: number, rgb: [number, number, number]) => {
    const o = (y * w + x) * 4;
    d[o] = rgb[0];
    d[o + 1] = rgb[1];
    d[o + 2] = rgb[2];
  };
  for (let y = 5; y < 20; y++) for (let x = 5; x < 20; x++) set(x, y, [230, 80, 80]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - 42) ** 2 + (y - 22) ** 2 < 81) set(x, y, [80, 120, 230]);
  for (let x = 5; x < 55; x++) set(x, 34, [20, 20, 20]);
  return d;
}

describe("diagram segmentation", () => {
  it("finds each coloured shape and the ink line", () => {
    const seg = segmentPixels(synthetic(), 60, 40);
    const names = seg.regions.map((r) => r.name);
    expect(names.some((n) => n.startsWith("Red"))).toBe(true);
    expect(names.some((n) => n.startsWith("Blue"))).toBe(true);
    expect(seg.regions.some((r) => r.ink)).toBe(true);
    const red = seg.regions.find((r) => r.name.startsWith("Red"))!;
    expect(red.bbox[0]).toBeCloseTo(5 / 60, 2);
    expect(red.area).toBeCloseTo(225 / 2400, 2);
  });
  it("treats a blank page as having no parts", () => {
    const blank = new Uint8ClampedArray(30 * 20 * 4).fill(255);
    expect(segmentPixels(blank, 30, 20).regions).toHaveLength(0);
  });
});
