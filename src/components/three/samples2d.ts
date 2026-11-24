import type { TemplateId } from "@/labs/types";
import { drawPulleyDiagram } from "./diagram2d";

/** Textbook-style line drawings for the sample gallery. Each draws into a 600 × 420 design space. */
type Draw = (ctx: CanvasRenderingContext2D) => void;

const INK = "#1d1d1d";

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 20, lineTo?: [number, number]) {
  ctx.save();
  if (lineTo) {
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + (lineTo[0] > x ? ctx.measureText(text).width + 4 : -4), y - size / 3);
    ctx.lineTo(lineTo[0], lineTo[1]);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.font = `${size}px Georgia, serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

const drawMotor: Draw = (ctx) => {
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  // magnets
  ctx.fillStyle = "#e86b6b";
  ctx.fillRect(40, 110, 110, 170);
  ctx.strokeRect(40, 110, 110, 170);
  ctx.fillStyle = "#6b8ee8";
  ctx.fillRect(450, 110, 110, 170);
  ctx.strokeRect(450, 110, 110, 170);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 46px Georgia, serif";
  ctx.fillText("N", 78, 212);
  ctx.fillText("S", 488, 212);
  // field lines
  ctx.strokeStyle = "#9aa0aa";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  for (const y of [135, 175, 215, 255]) {
    ctx.beginPath();
    ctx.moveTo(152, y);
    ctx.lineTo(448, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // coil (perspective rectangle)
  ctx.strokeStyle = "#c46a1c";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(210, 140);
  ctx.lineTo(390, 120);
  ctx.lineTo(390, 250);
  ctx.lineTo(210, 270);
  ctx.closePath();
  ctx.stroke();
  // force arrows
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2.5;
  const arrow = (x: number, y1: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    const d = Math.sign(y2 - y1);
    ctx.beginPath();
    ctx.moveTo(x, y2);
    ctx.lineTo(x - 7, y2 - 12 * d);
    ctx.lineTo(x + 7, y2 - 12 * d);
    ctx.fill();
  };
  arrow(195, 200, 120);
  arrow(405, 190, 270);
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillText("F", 168, 130);
  ctx.fillText("F", 415, 270);
  // commutator + brushes
  ctx.fillStyle = "#d9a441";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(300, 330, 26, Math.PI * 0.55, Math.PI * 1.45);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(300, 330, 26, -Math.PI * 0.45, Math.PI * 0.45);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#c46a1c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(250, 265);
  ctx.lineTo(285, 312);
  ctx.moveTo(350, 255);
  ctx.lineTo(315, 312);
  ctx.stroke();
  ctx.fillStyle = "#444";
  ctx.fillRect(244, 320, 26, 20);
  ctx.fillRect(330, 320, 26, 20);
  // battery
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(257, 340);
  ctx.lineTo(257, 395);
  ctx.lineTo(285, 395);
  ctx.moveTo(343, 340);
  ctx.lineTo(343, 395);
  ctx.lineTo(315, 395);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(290, 380);
  ctx.lineTo(290, 410);
  ctx.moveTo(306, 386);
  ctx.lineTo(306, 404);
  ctx.stroke();
  label(ctx, "coil", 400, 105, 18);
  label(ctx, "commutator", 165, 365, 16, [276, 336]);
  label(ctx, "brush", 360, 365, 16, [350, 336]);
};

const drawNeuron: Draw = (ctx) => {
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c99a3d";
  ctx.lineWidth = 6;
  const soma = [120, 210] as const;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    if (Math.cos(a) > 0.7) continue;
    ctx.beginPath();
    ctx.moveTo(soma[0] + Math.cos(a) * 40, soma[1] + Math.sin(a) * 40);
    const ex = soma[0] + Math.cos(a) * 95;
    const ey = soma[1] + Math.sin(a) * 95;
    ctx.quadraticCurveTo(soma[0] + Math.cos(a + 0.3) * 70, soma[1] + Math.sin(a + 0.3) * 70, ex, ey);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(a + 0.6) * 25, ey + Math.sin(a + 0.6) * 25);
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(a - 0.6) * 25, ey + Math.sin(a - 0.6) * 25);
    ctx.stroke();
    ctx.lineWidth = 6;
  }
  ctx.fillStyle = "#f6d79a";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(soma[0], soma[1], 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e59a84";
  ctx.beginPath();
  ctx.arc(soma[0] + 5, soma[1], 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // axon
  ctx.strokeStyle = "#c99a3d";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(165, 210);
  ctx.lineTo(480, 210);
  ctx.stroke();
  ctx.fillStyle = "#a8dcef";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (let x = 200; x < 450; x += 62) {
    ctx.beginPath();
    ctx.roundRect(x, 196, 50, 28, 14);
    ctx.fill();
    ctx.stroke();
  }
  // terminals
  ctx.strokeStyle = "#c99a3d";
  ctx.lineWidth = 4;
  for (const dy of [-50, -15, 20, 55]) {
    ctx.beginPath();
    ctx.moveTo(480, 210);
    ctx.quadraticCurveTo(510, 210 + dy * 0.4, 535, 210 + dy);
    ctx.stroke();
    ctx.fillStyle = "#f6d79a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(540, 210 + dy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#c99a3d";
    ctx.lineWidth = 4;
  }
  label(ctx, "dendrites", 20, 70, 18, [70, 140]);
  label(ctx, "cell body", 60, 330, 18, [110, 255]);
  label(ctx, "nucleus", 170, 120, 16, [128, 198]);
  label(ctx, "myelin sheath", 250, 150, 18, [290, 196]);
  label(ctx, "axon", 330, 290, 18, [345, 215]);
  label(ctx, "axon terminals", 440, 340, 18, [535, 270]);
};

const drawCell: Draw = (ctx) => {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillStyle = "#fdeccf";
  ctx.beginPath();
  ctx.ellipse(300, 210, 250, 175, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // nucleus
  ctx.fillStyle = "#d9b8f0";
  ctx.beginPath();
  ctx.ellipse(290, 200, 80, 65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#8f5cc2";
  ctx.beginPath();
  ctx.arc(305, 195, 22, 0, Math.PI * 2);
  ctx.fill();
  // mitochondria
  ctx.fillStyle = "#f4a3a3";
  for (const [x, y, r] of [
    [140, 150, 0.4],
    [450, 290, -0.3],
    [170, 300, 0.2],
  ] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r);
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    for (let i = 0; i < 6; i++) ctx.lineTo(-22 + i * 10, i % 2 ? 9 : -9);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.restore();
  }
  // golgi
  ctx.strokeStyle = "#d18b2c";
  ctx.lineWidth = 5;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(450, 150 + i * 13, 45 - i * 6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  // ER
  ctx.strokeStyle = "#5c9bd1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    ctx.moveTo(200, 230 + i * 12);
    ctx.bezierCurveTo(240, 270 + i * 12, 300, 300 + i * 6, 360, 280 + i * 10);
  }
  ctx.stroke();
  ctx.fillStyle = "#2f4f7a";
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    ctx.arc(215 + i * 6, 250 + Math.sin(i) * 18 + i * 1.6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // lysosome
  ctx.fillStyle = "#b9e3a8";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(390, 330, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = INK;
  label(ctx, "nucleus", 250, 30, 18, [290, 140]);
  label(ctx, "mitochondrion", 20, 60, 18, [130, 140]);
  label(ctx, "Golgi body", 470, 70, 18, [460, 120]);
  label(ctx, "rough ER", 120, 400, 18, [230, 290]);
  label(ctx, "lysosome", 430, 405, 18, [395, 345]);
  label(ctx, "cell membrane", 470, 390, 16, [490, 330]);
};

const drawIndicator: Draw = (ctx) => {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  // beaker
  ctx.beginPath();
  ctx.moveTo(190, 130);
  ctx.lineTo(200, 380);
  ctx.lineTo(400, 380);
  ctx.lineTo(410, 130);
  ctx.stroke();
  ctx.fillStyle = "#f04f9b";
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(196, 240);
  ctx.lineTo(202, 377);
  ctx.lineTo(398, 377);
  ctx.lineTo(404, 240);
  ctx.fill();
  ctx.globalAlpha = 1;
  // dropper
  ctx.fillStyle = "#cfe9ff";
  ctx.fillRect(285, 20, 30, 120);
  ctx.strokeRect(285, 20, 30, 120);
  ctx.fillStyle = "#3d4566";
  ctx.beginPath();
  ctx.ellipse(300, 18, 22, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cfe9ff";
  ctx.beginPath();
  ctx.moveTo(285, 140);
  ctx.lineTo(300, 170);
  ctx.lineTo(315, 140);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#cfe9ff";
  ctx.beginPath();
  ctx.arc(300, 200, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // pH strip
  const cols = ["#f6a04d", "#f6a04d", "#f6a04d", "#f2f2f2", "#f2f2f2", "#f2f2f2", "#f2f2f2", "#f2f2f2", "#f04f9b", "#f04f9b", "#f04f9b", "#f2f2f2", "#f2f2f2", "#f2f2f2", "#f2f2f2"];
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(470 + (i % 2) * 50, 60 + Math.floor(i / 2) * 40, 45, 34);
    ctx.lineWidth = 1;
    ctx.strokeRect(470 + (i % 2) * 50, 60 + Math.floor(i / 2) * 40, 45, 34);
    ctx.fillStyle = INK;
    ctx.font = "13px Georgia, serif";
    ctx.fillText(String(i), 474 + (i % 2) * 50, 74 + Math.floor(i / 2) * 40);
  });
  label(ctx, "phenolphthalein", 40, 60, 18, [282, 70]);
  label(ctx, "base (pH 9)", 40, 320, 18, [200, 320]);
  label(ctx, "pH chart", 480, 40, 16);
};

const drawElectrolysis: Draw = (ctx) => {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  // trough
  ctx.fillStyle = "#d7ecfb";
  ctx.fillRect(110, 230, 380, 140);
  ctx.beginPath();
  ctx.moveTo(110, 170);
  ctx.lineTo(110, 370);
  ctx.lineTo(490, 370);
  ctx.lineTo(490, 170);
  ctx.stroke();
  // tubes
  const tube = (x: number, gas: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 25, 60, 50, 230);
    ctx.fillStyle = "#d7ecfb";
    ctx.fillRect(x - 25, 60 + gas, 50, 230 - gas);
    ctx.strokeRect(x - 25, 60, 50, 230);
    ctx.beginPath();
    ctx.arc(x, 60, 25, Math.PI, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.stroke();
  };
  tube(210, 120);
  tube(390, 60);
  // electrodes
  ctx.fillStyle = "#555";
  ctx.fillRect(203, 250, 14, 100);
  ctx.fillRect(383, 250, 14, 100);
  // wires + battery
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(210, 350);
  ctx.lineTo(210, 400);
  ctx.lineTo(285, 400);
  ctx.moveTo(390, 350);
  ctx.lineTo(390, 400);
  ctx.lineTo(315, 400);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(290, 385);
  ctx.lineTo(290, 415);
  ctx.moveTo(308, 391);
  ctx.lineTo(308, 409);
  ctx.stroke();
  // bubbles
  ctx.strokeStyle = "#5a7fa3";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(205 + (i % 3) * 5, 240 - i * 12, 4, 0, Math.PI * 2);
    ctx.stroke();
    if (i < 4) {
      ctx.beginPath();
      ctx.arc(388 + (i % 2) * 5, 240 - i * 14, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = INK;
  label(ctx, "hydrogen", 40, 90, 18, [184, 120]);
  label(ctx, "oxygen", 470, 90, 18, [416, 110]);
  label(ctx, "cathode (−)", 30, 300, 16, [202, 300]);
  label(ctx, "anode (+)", 460, 300, 16, [398, 300]);
  label(ctx, "dilute acid", 240, 220, 16);
};

const DRAWERS: Record<Exclude<TemplateId, "generic">, Draw> = {
  "pulley-incline": (ctx) => drawPulleyDiagram(ctx, 600, 420, false),
  "dc-motor": drawMotor,
  neuron: drawNeuron,
  "animal-cell": drawCell,
  phenolphthalein: drawIndicator,
  electrolysis: drawElectrolysis,
};

/** Draw a sample diagram on white paper, scaled to fit the canvas. */
export function drawSample(id: Exclude<TemplateId, "generic">, ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const s = Math.min(w / 600, h / 420);
  ctx.translate((w - 600 * s) / 2, (h - 420 * s) / 2);
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  DRAWERS[id](ctx);
  ctx.restore();
}

/** The sample as a PNG data URL, so it can go through the same analysis path as an upload. */
export function sampleDataUrl(id: Exclude<TemplateId, "generic">, w = 900, h = 630) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  drawSample(id, c.getContext("2d")!, w, h);
  return c.toDataURL("image/png");
}
