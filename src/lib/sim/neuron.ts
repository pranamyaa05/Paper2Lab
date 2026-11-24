/** Simplified neuron rules for the biology lab. */
export const RESTING_MV = -70;
export const THRESHOLD_MV = -55;

/** All-or-none: fires only when the stimulus depolarises the membrane to threshold. */
export function firesActionPotential(stimulusMv: number): boolean {
  return RESTING_MV + stimulusMv >= THRESHOLD_MV;
}

/**
 * Conduction velocity in m/s for an axon of the given diameter (µm).
 * Myelinated: ~6 m/s per µm (Hursh). Unmyelinated: grows with √diameter.
 */
export function conductionVelocity(myelinated: boolean, diameterUm: number): number {
  return myelinated ? 6 * diameterUm : Math.sqrt(diameterUm);
}
