/** Electrolysis of water (acidified or with a dissolved salt) with inert electrodes. */
export const FARADAY = 96485; // C/mol
export const MOLAR_VOLUME_L = 24.0; // L/mol at room temperature and pressure
/** Practical decomposition voltage: 1.23 V thermodynamic plus electrode overpotentials. */
export const DECOMPOSITION_V = 1.8;

/** Cell resistance in ohms: pure water barely conducts; dissolved ions lower the resistance sharply. */
export function cellResistance(concentrationM: number): number {
  return 1.5 + 0.6 / (Math.max(0, concentrationM) + 0.005);
}

/** Current through the cell in amperes. No electrolysis happens below the decomposition voltage. */
export function cellCurrent(voltage: number, concentrationM: number): number {
  return Math.max(0, voltage - DECOMPOSITION_V) / cellResistance(concentrationM);
}

/**
 * Gas collected after `seconds` at `current` amperes.
 * Cathode: 2H₂O + 2e⁻ → H₂ + 2OH⁻   Anode: 2H₂O → O₂ + 4H⁺ + 4e⁻
 * So each mole of electrons gives ½ mol H₂ and ¼ mol O₂, a 2 : 1 volume ratio.
 */
export function gasVolumes(current: number, seconds: number) {
  const molElectrons = (current * seconds) / FARADAY;
  const h2 = molElectrons / 2;
  const o2 = molElectrons / 4;
  return { molElectrons, h2mL: h2 * MOLAR_VOLUME_L * 1000, o2mL: o2 * MOLAR_VOLUME_L * 1000 };
}
