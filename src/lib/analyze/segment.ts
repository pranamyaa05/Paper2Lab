/**
 * Splits a diagram into coloured regions with no AI and no network: k-means on colour, then
 * connected components. The 3D "materialize" view raises each region off the page, and in
 * demo mode the regions double as the diagram's parts.
 */
export interface Region {
  index: number;
  color: string;
  rgb: [number, number, number];
  /** Fraction of the whole image. */
  area: number;
  /** [x, y, w, h] as fractions of the image. */
  bbox: [number, number, number, number];
  centroid: [number, number];
  /** Dark, thin strokes: outlines, arrows and text labels. */
  ink: boolean;
  name: string;
}

export interface Segmentation {
  w: number;
  h: number;
  /** Region index per cell, or −1 for the paper background. Row-major. */
  labels: Int16Array;
  regions: Region[];
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function dist2(a: ArrayLike<number>, b: ArrayLike<number>) {
  const dr = a[0]! - b[0]!;
  const dg = a[1]! - b[1]!;
  const db = a[2]! - b[2]!;
  return dr * dr + dg * dg + db * db;
}

function lum(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sat(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

const NAMED: [string, [number, number, number]][] = [
  ["Red", [220, 70, 70]],
  ["Orange", [240, 150, 60]],
  ["Yellow", [235, 210, 80]],
  ["Cream", [245, 225, 180]],
  ["Green", [90, 180, 100]],
  ["Teal", [70, 170, 170]],
  ["Sky blue", [140, 200, 240]],
  ["Blue", [80, 120, 220]],
  ["Purple", [150, 100, 200]],
  ["Pink", [240, 120, 170]],
  ["Brown", [150, 95, 50]],
  ["Grey", [150, 150, 155]],
  ["Dark", [40, 40, 45]],
];

export function colorName(rgb: [number, number, number]) {
  let best = NAMED[0]!;
  let bd = Infinity;
  for (const n of NAMED) {
    const d = dist2(rgb, n[1]);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best[0];
}

/** Segment RGBA pixels (already downscaled to roughly 100–140 px on the long side). */
export function segmentPixels(data: Uint8ClampedArray, w: number, h: number, k = 7): Segmentation {
  const n = w * h;
  // 1. Paper colour: median of the border pixels.
  const border: number[][] = [];
  for (let x = 0; x < w; x++) {
    border.push([data[x * 4]!, data[x * 4 + 1]!, data[x * 4 + 2]!]);
    const o = ((h - 1) * w + x) * 4;
    border.push([data[o]!, data[o + 1]!, data[o + 2]!]);
  }
  for (let y = 0; y < h; y++) {
    const a = y * w * 4;
    const b = (y * w + w - 1) * 4;
    border.push([data[a]!, data[a + 1]!, data[a + 2]!], [data[b]!, data[b + 1]!, data[b + 2]!]);
  }
  const med = (i: number) => border.map((p) => p[i]!).sort((a, b) => a - b)[Math.floor(border.length / 2)]!;
  const paper = [med(0), med(1), med(2)];

  const fg = new Uint8Array(n);
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const a = data[i * 4 + 3]!;
    const isPaper = a < 40 || dist2([r, g, b], paper) < 38 * 38 || (lum(r, g, b) > 238 && sat(r, g, b) < 0.08);
    if (!isPaper) {
      fg[i] = 1;
      pts.push(i);
    }
  }

  const labels = new Int16Array(n).fill(-1);
  if (pts.length < 20) return { w, h, labels, regions: [] };

  // 2. k-means++ on foreground colours with a fixed seed, so results are repeatable.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const col = (i: number) => [data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!];
  const centers: number[][] = [col(pts[Math.floor(rnd() * pts.length)]!)];
  const sample = pts.length > 4000 ? pts.filter((_, j) => j % Math.ceil(pts.length / 4000) === 0) : pts;
  while (centers.length < Math.min(k, sample.length)) {
    const d = sample.map((i) => Math.min(...centers.map((c) => dist2(col(i), c))));
    const total = d.reduce((s, v) => s + v, 0);
    if (total === 0) break;
    let r = rnd() * total;
    let pick = 0;
    for (; pick < d.length - 1 && r > d[pick]!; pick++) r -= d[pick]!;
    centers.push(col(sample[pick]!));
  }
  const assign = new Int16Array(n).fill(-1);
  for (let iter = 0; iter < 12; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const i of pts) {
      const c = col(i);
      let best = 0;
      let bd = Infinity;
      centers.forEach((cc, j) => {
        const dd = dist2(c, cc);
        if (dd < bd) {
          bd = dd;
          best = j;
        }
      });
      assign[i] = best;
      const s = sums[best]!;
      s[0]! += c[0]!;
      s[1]! += c[1]!;
      s[2]! += c[2]!;
      s[3]! += 1;
    }
    centers.forEach((c, j) => {
      const s = sums[j]!;
      if (s[3]! > 0) {
        c[0] = s[0]! / s[3]!;
        c[1] = s[1]! / s[3]!;
        c[2] = s[2]! / s[3]!;
      }
    });
  }

  // 3. Connected components within each colour cluster.
  const minArea = Math.max(6, Math.round(n * 0.0025));
  const comp = new Int32Array(n).fill(-1);
  type Raw = { cluster: number; cells: number[] };
  const raws: Raw[] = [];
  const stack: number[] = [];
  for (const start of pts) {
    if (comp[start] !== -1) continue;
    const cluster = assign[start]!;
    const cells: number[] = [];
    comp[start] = raws.length;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      cells.push(i);
      const x = i % w;
      const y = (i - x) / w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) {
        if (j >= 0 && fg[j] && comp[j] === -1 && assign[j] === cluster) {
          comp[j] = raws.length;
          stack.push(j);
        }
      }
    }
    raws.push({ cluster, cells });
  }

  // 4. Keep the biggest components as regions; fold specks of ink into one "outlines" region.
  const kept = raws.filter((r) => r.cells.length >= minArea).sort((a, b) => b.cells.length - a.cells.length);
  const regions: Region[] = [];
  const isInkCluster = (c: number) => lum(centers[c]![0]!, centers[c]![1]!, centers[c]![2]!) < 85;
  let inkIndex = -1;
  const take = (cells: number[], cluster: number, ink: boolean) => {
    const c = centers[cluster]!;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let sx = 0;
    let sy = 0;
    for (const i of cells) {
      const x = i % w;
      const y = (i - x) / w;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      sx += x;
      sy += y;
    }
    const rgb: [number, number, number] = [c[0]!, c[1]!, c[2]!];
    return {
      index: regions.length,
      color: hex(...rgb),
      rgb,
      area: cells.length / n,
      bbox: [minX / w, minY / h, (maxX - minX + 1) / w, (maxY - minY + 1) / h] as [number, number, number, number],
      centroid: [sx / cells.length / w, sy / cells.length / h] as [number, number],
      ink,
      name: ink ? "Outlines & labels" : `${colorName(rgb)} part`,
    };
  };
  for (const r of kept) {
    const ink = isInkCluster(r.cluster);
    if (ink) {
      if (inkIndex === -1) {
        inkIndex = regions.length;
        regions.push(take(r.cells, r.cluster, true));
      }
      for (const i of r.cells) labels[i] = inkIndex;
      continue;
    }
    if (regions.length >= 14) break;
    const reg = take(r.cells, r.cluster, false);
    regions.push(reg);
    for (const i of r.cells) labels[i] = reg.index;
  }
  // Small ink specks (letters, thin arrows) join the outlines region so the drawing keeps its labels.
  for (const r of raws) {
    if (!isInkCluster(r.cluster) || r.cells.length >= minArea) continue;
    if (inkIndex === -1) {
      inkIndex = regions.length;
      regions.push(take(r.cells, r.cluster, true));
    }
    for (const i of r.cells) labels[i] = inkIndex;
  }
  if (inkIndex >= 0) {
    const cells = [];
    for (let i = 0; i < n; i++) if (labels[i] === inkIndex) cells.push(i);
    regions[inkIndex]!.area = cells.length / n;
  }

  // Number repeated colour names: "Blue part 1", "Blue part 2".
  const counts = new Map<string, number>();
  regions.forEach((r) => counts.set(r.name, (counts.get(r.name) ?? 0) + 1));
  const seen = new Map<string, number>();
  regions.forEach((r) => {
    if ((counts.get(r.name) ?? 0) > 1) {
      const k2 = (seen.get(r.name) ?? 0) + 1;
      seen.set(r.name, k2);
      r.name = `${r.name} ${k2}`;
    }
  });
  return { w, h, labels, regions };
}

/** Load an image URL, downscale it and segment it. Browser only. */
export async function segmentImage(url: string, longSide = 120): Promise<Segmentation & { aspect: number }> {
  const img = await loadImage(url);
  const aspect = img.naturalWidth / img.naturalHeight;
  const w = aspect >= 1 ? longSide : Math.max(8, Math.round(longSide * aspect));
  const h = aspect >= 1 ? Math.max(8, Math.round(longSide / aspect)) : longSide;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return { ...segmentPixels(data, w, h), aspect };
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = url;
  });
}
