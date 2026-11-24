/** The pulley-on-incline diagram, drawn like the textbook figure. */
export function drawPulleyDiagram(ctx: CanvasRenderingContext2D, w: number, h: number, withPaper = true) {
  ctx.save();
  if (withPaper) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  const s = Math.min(w / 600, h / 420);
  ctx.translate((w - 600 * s) / 2, (h - 420 * s) / 2);
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  // incline
  ctx.fillStyle = "#f5a95a";
  ctx.strokeStyle = "#1d1d1d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(30, 380);
  ctx.lineTo(440, 380);
  ctx.lineTo(440, 120);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // theta arc
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(30, 380, 110, -Math.atan2(260, 410), 0);
  ctx.stroke();
  ctx.fillStyle = "#1d1d1d";
  ctx.font = "italic 34px Georgia, serif";
  ctx.fillText("θ", 150, 360);
  // block M (rotated on slope)
  const ang = Math.atan2(260, 410);
  ctx.save();
  ctx.translate(210, 380 - 180 * Math.tan(ang));
  ctx.rotate(-ang);
  ctx.fillStyle = "#adc3ff";
  ctx.fillRect(-60, -120, 120, 120);
  ctx.strokeRect(-60, -120, 120, 120);
  ctx.restore();
  ctx.fillStyle = "#1d1d1d";
  ctx.font = "italic 40px Georgia, serif";
  ctx.fillText("M", 165, 110);
  // rope up slope
  ctx.strokeStyle = "#a0521d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(268, 202);
  ctx.lineTo(448, 88);
  ctx.stroke();
  // pulley bracket + wheel
  ctx.fillStyle = "#6b6f78";
  ctx.strokeStyle = "#1d1d1d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(410, 140);
  ctx.lineTo(450, 70);
  ctx.lineTo(480, 90);
  ctx.lineTo(440, 175);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(465, 85, 30, 0, Math.PI * 2);
  ctx.fillStyle = "#9aa0aa";
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(465, 85, 20, 0, Math.PI * 2);
  ctx.fillStyle = "#c9ccd2";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(465, 85, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#1e2a6b";
  ctx.fill();
  // hanging rope + block m
  ctx.strokeStyle = "#a0521d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(495, 88);
  ctx.lineTo(495, 210);
  ctx.stroke();
  ctx.fillStyle = "#adc3ff";
  ctx.strokeStyle = "#1d1d1d";
  ctx.lineWidth = 3;
  ctx.fillRect(450, 210, 95, 95);
  ctx.strokeRect(450, 210, 95, 95);
  ctx.fillStyle = "#1d1d1d";
  ctx.font = "italic 36px Georgia, serif";
  ctx.fillText("m", 558, 280);
  ctx.restore();
}

