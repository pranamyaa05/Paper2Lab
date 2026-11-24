/** Block M on a frictional incline, connected over a pulley to a hanging block m. */
export const G = 9.8;

export interface PulleyParams {
  M: number; // kg, block on the incline
  m: number; // kg, hanging block
  thetaDeg: number; // incline angle
  mu: number; // friction coefficient between M and incline
  g?: number;
}

export type PulleyMotion = "m-falls" | "M-slides-down" | "at-rest";

export interface PulleyResult {
  /** Signed acceleration (m/s²). Positive: m falls and M moves up the slope. */
  acceleration: number;
  tension: number;
  motion: PulleyMotion;
  drivingForce: number;
  maxFriction: number;
}

export function solvePulley({ M, m, thetaDeg, mu, g = G }: PulleyParams): PulleyResult {
  const th = (thetaDeg * Math.PI) / 180;
  const drivingForce = m * g - M * g * Math.sin(th);
  const maxFriction = mu * M * g * Math.cos(th);
  if (Math.abs(drivingForce) <= maxFriction) {
    return { acceleration: 0, tension: m * g, motion: "at-rest", drivingForce, maxFriction };
  }
  const acceleration = (drivingForce - Math.sign(drivingForce) * maxFriction) / (M + m);
  return {
    acceleration,
    tension: m * (g - acceleration),
    motion: acceleration > 0 ? "m-falls" : "M-slides-down",
    drivingForce,
    maxFriction,
  };
}
