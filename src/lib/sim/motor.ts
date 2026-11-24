/**
 * DC motor: a rectangular coil of N turns in a uniform field B, fed from a battery of voltage V
 * through a split-ring commutator. As the coil spins it generates a back-EMF that opposes the
 * battery, so the current (and torque) fall as the motor speeds up.
 */
export interface MotorParams {
  voltage: number; // V, battery
  field: number; // T
  turns: number;
  /** Coil area in m² (default 10 cm × 10 cm). */
  area?: number;
}

export const COIL_SIDE = 0.1; // m, length of each side in the field
export const COIL_RESISTANCE = 2; // Ω, armature winding
export const MOTOR_INERTIA = 0.004; // kg·m², coil + axle; enough momentum to carry it past the dead point
export const MOTOR_DAMPING = 0.002; // N·m·s, bearing + air friction

/** Motor constant k = N·B·A (V·s/rad and N·m/A): links speed to back-EMF and current to torque. */
export function motorConstant({ field, turns, area = COIL_SIDE * COIL_SIDE }: MotorParams): number {
  return turns * field * area;
}

/** Current at the instant of starting (no back-EMF yet): I = V / R. */
export function stallCurrent(p: MotorParams): number {
  return p.voltage / COIL_RESISTANCE;
}

/** Largest torque, at start-up with the coil parallel to the field: τ = k·V/R. */
export function peakTorque(p: MotorParams): number {
  return motorConstant(p) * stallCurrent(p);
}

/** Back-EMF at angular speed ω and coil angle φ: e = k·ω·|cos φ| (the commutator rectifies it). */
export function backEmf(omega: number, phi: number, p: MotorParams): number {
  return motorConstant(p) * omega * Math.abs(Math.cos(phi));
}

/** Coil current at speed ω and angle φ: I = (V − e) / R. */
export function currentAt(omega: number, phi: number, p: MotorParams, direction: 1 | -1 = 1): number {
  return (direction * p.voltage - backEmf(omega, phi, p)) / COIL_RESISTANCE;
}

/** Torque at speed ω and angle φ: τ = k·I·|cos φ|. */
export function torqueAt(phi: number, p: MotorParams, omega = 0, direction: 1 | -1 = 1): number {
  return motorConstant(p) * currentAt(omega, phi, p, direction) * Math.abs(Math.cos(phi));
}

/**
 * Steady speed, averaging over a turn (⟨|cos φ|⟩ = 2/π, ⟨cos² φ⟩ = ½):
 * (k/R)·(V·2/π − k·ω/2) = b·ω  ⇒  ω = (2/π)·k·V/R ÷ (b + k²/2R).
 */
export function steadyOmega(p: MotorParams, damping = MOTOR_DAMPING): number {
  const k = motorConstant(p);
  return ((2 / Math.PI) * k * p.voltage) / COIL_RESISTANCE / (damping + (k * k) / (2 * COIL_RESISTANCE));
}

/** Average back-EMF and current once the motor has reached its steady speed. */
export function runningState(p: MotorParams) {
  const w = steadyOmega(p);
  const emf = motorConstant(p) * w * (2 / Math.PI);
  return { omega: w, backEmf: emf, current: (p.voltage - emf) / COIL_RESISTANCE };
}

/** Force on each side of the coil: F = N·B·I·L. */
export function sideForce(p: MotorParams, current = runningState(p).current): number {
  return p.turns * p.field * Math.abs(current) * COIL_SIDE;
}

export const toRpm = (omega: number) => (omega * 60) / (2 * Math.PI);

/** One integration step: J·dω/dt = τ(ω, φ) − b·ω. Reversing the battery reverses the spin. */
export function stepMotor(state: { phi: number; omega: number }, p: MotorParams, dt: number, direction: 1 | -1 = 1) {
  const tau = torqueAt(state.phi, p, state.omega, direction);
  state.omega += ((tau - MOTOR_DAMPING * state.omega) / MOTOR_INERTIA) * dt;
  state.phi += state.omega * dt;
  return state;
}
