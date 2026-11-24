/** Animal cell physiology: osmosis (tonicity) and ATP production by aerobic respiration. */

/** Osmolarity of cytoplasm and of an isotonic solution such as blood plasma, mOsm/L. */
export const INSIDE_MOSM = 300;
/** Fraction of cell volume that doesn't take part in osmosis (solids, proteins). */
export const NON_OSMOTIC = 0.25;
/** A red-blood-cell-like animal cell bursts beyond about this swelling (no cell wall to resist it). */
export const LYSIS_RATIO = 1.45;
export const CRENATION_RATIO = 0.85;
/** ATP made per glucose by aerobic respiration; most of it by chemiosmosis in the mitochondria. */
export const ATP_PER_GLUCOSE = 30;

/** Boyle–van 't Hoff: V/V₀ = b + (1 − b)·(c_in / c_out). */
export function volumeRatio(outsideMosm: number): number {
  const out = Math.max(10, outsideMosm);
  return NON_OSMOTIC + (1 - NON_OSMOTIC) * (INSIDE_MOSM / out);
}

export type Tonicity = "hypotonic" | "isotonic" | "hypertonic";

export function tonicity(outsideMosm: number): Tonicity {
  if (outsideMosm < INSIDE_MOSM - 15) return "hypotonic";
  if (outsideMosm > INSIDE_MOSM + 15) return "hypertonic";
  return "isotonic";
}

/** What happens to the cell: water flow, size, and whether it bursts (lysis) or shrivels (crenation). */
export function osmosisState(outsideMosm: number) {
  const ratio = volumeRatio(outsideMosm);
  const t = tonicity(outsideMosm);
  const fate = ratio >= LYSIS_RATIO ? "bursts (lysis)" : ratio <= CRENATION_RATIO ? "shrivels (crenation)" : t === "hypotonic" ? "swells" : t === "hypertonic" ? "shrinks" : "stays the same";
  const water = t === "hypotonic" ? "into the cell" : t === "hypertonic" ? "out of the cell" : "in and out equally";
  return { ratio, tonicity: t, fate, water, lysed: ratio >= LYSIS_RATIO };
}

/**
 * Respiration rate scaled from energy demand (0–100 %). A resting cell turns over roughly
 * 10⁷ ATP per second; heavy demand raises glucose use several-fold.
 */
export function respiration(energyPct: number) {
  const glucosePerSec = 0.4e6 + (energyPct / 100) * 2.6e6;
  return { glucosePerSec, atpPerSec: glucosePerSec * ATP_PER_GLUCOSE, o2PerSec: glucosePerSec * 6 };
}
