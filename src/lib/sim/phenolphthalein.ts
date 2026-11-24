/** Phenolphthalein colour by pH, following the textbook chart (0-3, 4-7, 8-10, 11-14). */
export type IndicatorLabel = "Orange" | "Colorless" | "Pink";

export interface IndicatorState {
  label: IndicatorLabel;
  range: string;
  /** Liquid colour for the 3D beaker. */
  color: string;
  /** How opaque the liquid looks: coloured forms are vivid, colorless forms are nearly clear. */
  opacity: number;
  note: string;
}

export function phenolphthaleinColor(pH: number): IndicatorState {
  if (pH < 4) {
    return { label: "Orange", range: "pH 0–3", color: "#f6a04d", opacity: 0.88, note: "In strongly acidic solution the molecule is protonated and looks orange." };
  }
  if (pH < 8) {
    return { label: "Colorless", range: "pH 4–7", color: "#cfe6fb", opacity: 0.4, note: "In acidic to neutral solution the lactone form absorbs no visible light — it looks clear." };
  }
  if (pH < 11) {
    return { label: "Pink", range: "pH 8–10", color: "#f04f9b", opacity: 0.9, note: "In basic solution the ring opens; the charged form absorbs green light and looks pink." };
  }
  return { label: "Colorless", range: "pH 11–14", color: "#cfe6fb", opacity: 0.4, note: "In very strong base an OH⁻ adds on, breaking the conjugation — colour fades again." };
}
