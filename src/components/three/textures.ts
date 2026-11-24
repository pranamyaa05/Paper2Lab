import * as THREE from "three";
import { drawPulleyDiagram } from "./diagram2d";

/** Deterministic PRNG so pages look the same on every load. */
export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAPER = "#fbf7ec";
const INK = "#3b4466";

function textLines(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rows: number, rnd: () => number, gap = 26) {
  ctx.fillStyle = "#c9cbd6";
  for (let i = 0; i < rows; i++) {
    const lw = i % 6 === 5 ? w * (0.3 + rnd() * 0.3) : w * (0.85 + rnd() * 0.15);
    ctx.fillRect(x, y + i * gap, lw, 7);
  }
}

/** A textbook page with headings and grey text lines; optionally the pulley figure. */
export function makePageTexture(kind: "text" | "diagram", seed: number) {
  const w = 768;
  const h = 1040;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry(seed);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.font = "bold 34px Georgia, serif";
  if (kind === "diagram") {
    ctx.fillText("5.3  Motion of connected bodies", 60, 90);
    textLines(ctx, 60, 130, w - 120, 5, rnd);
    ctx.save();
    ctx.translate(70, 290);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w - 140, 440);
    ctx.strokeStyle = "#e3dfd2";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w - 140, 440);
    drawPulleyDiagram(ctx, w - 140, 440, false);
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = "italic 24px Georgia, serif";
    ctx.fillText("Fig 5.3  Two masses connected over a pulley", 120, 775);
    textLines(ctx, 60, 820, w - 120, 7, rnd);
  } else {
    ctx.fillText(rnd() > 0.5 ? "Forces and Laws of Motion" : "Work, Energy and Power", 60, 90);
    textLines(ctx, 60, 140, w - 120, 14, rnd);
    ctx.fillStyle = "#e9eef9";
    ctx.fillRect(60, 520, w - 120, 150);
    ctx.fillStyle = INK;
    ctx.font = "italic 28px Georgia, serif";
    ctx.fillText("F = m · a", w / 2 - 60, 605);
    textLines(ctx, 60, 710, w - 120, 11, rnd);
  }
  ctx.fillStyle = "#9aa0b5";
  ctx.font = "20px Georgia, serif";
  ctx.fillText(String(60 + seed), w / 2 - 12, h - 30);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeCoverTexture() {
  const w = 768;
  const h = 1040;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#bfe0fb");
  g.addColorStop(0.55, "#d9d3f4");
  g.addColorStop(1, "#f8cbd8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.62, 210, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5c6aa8";
  ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(w * 0.72, h * 0.62);
    ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 160, 55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#f2b84b";
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.62, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#34406e";
  ctx.font = "bold 92px Georgia, serif";
  ctx.fillText("SCIENCE", 60, 190);
  ctx.font = "34px Georgia, serif";
  ctx.fillText("Textbook for Class IX", 64, 250);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
