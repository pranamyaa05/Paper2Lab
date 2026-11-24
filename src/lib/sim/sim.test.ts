import { describe, expect, it } from "vitest";
import { solvePulley } from "./pulley";
import { phenolphthaleinColor } from "./phenolphthalein";
import { conductionVelocity, firesActionPotential } from "./neuron";

describe("pulley on an incline", () => {
  it("frictionless: a = g(m − M sinθ)/(M + m)", () => {
    const r = solvePulley({ M: 2, m: 3, thetaDeg: 30, mu: 0 });
    expect(r.acceleration).toBeCloseTo((9.8 * (3 - 2 * 0.5)) / 5, 5);
    expect(r.motion).toBe("m-falls");
    expect(r.tension).toBeCloseTo(3 * (9.8 - r.acceleration), 5);
  });

  it("stays at rest when friction can hold it", () => {
    expect(solvePulley({ M: 2, m: 1, thetaDeg: 30, mu: 0.5 }).motion).toBe("at-rest");
  });

  it("heavy M slides down the slope", () => {
    const r = solvePulley({ M: 6, m: 1, thetaDeg: 45, mu: 0 });
    expect(r.motion).toBe("M-slides-down");
    expect(r.acceleration).toBeLessThan(0);
  });
});

describe("phenolphthalein chart", () => {
  it.each([
    [2, "Orange"],
    [5, "Colorless"],
    [9, "Pink"],
    [13, "Colorless"],
  ] as const)("pH %d is %s", (pH, label) => {
    expect(phenolphthaleinColor(pH).label).toBe(label);
  });
});

describe("neuron", () => {
  it("fires only at or above −55 mV threshold", () => {
    expect(firesActionPotential(10)).toBe(false);
    expect(firesActionPotential(15)).toBe(true);
  });
  it("myelin makes conduction faster", () => {
    expect(conductionVelocity(true, 10)).toBe(60);
    expect(conductionVelocity(false, 10)).toBeLessThan(60);
  });
});

import { backEmf, currentAt, motorConstant, peakTorque, runningState, sideForce, stallCurrent, stepMotor, steadyOmega, torqueAt } from "./motor";
import { cellCurrent, gasVolumes, FARADAY } from "./electrolysis";
import { osmosisState, respiration, volumeRatio, ATP_PER_GLUCOSE } from "./cell";

describe("dc motor with back-EMF", () => {
  const p = { voltage: 6, field: 0.5, turns: 20 };
  it("motor constant is N·B·A", () => {
    expect(motorConstant(p)).toBeCloseTo(20 * 0.5 * 0.01, 9);
  });
  it("start-up current is V/R and start-up torque is k·V/R", () => {
    expect(stallCurrent(p)).toBeCloseTo(3, 9);
    expect(peakTorque(p)).toBeCloseTo(0.1 * 3, 9);
  });
  it("commutator keeps torque one-signed at start-up", () => {
    for (let a = 0; a < 7; a += 0.3) expect(torqueAt(a, p)).toBeGreaterThanOrEqual(0);
  });
  it("back-EMF lowers the current as the coil speeds up", () => {
    expect(backEmf(20, 0, p)).toBeCloseTo(2, 9);
    expect(currentAt(20, 0, p)).toBeLessThan(stallCurrent(p));
  });
  it("running current is well below start-up current", () => {
    const run = runningState(p);
    expect(run.current).toBeLessThan(stallCurrent(p) * 0.7);
    expect(run.backEmf).toBeGreaterThan(1);
    expect(sideForce(p, run.current)).toBeLessThan(sideForce(p, stallCurrent(p)));
  });
  it("a stronger field lowers the top speed once back-EMF dominates", () => {
    expect(steadyOmega({ ...p, field: 1, turns: 50 })).toBeLessThan(steadyOmega({ ...p, field: 0.5, turns: 50 }));
  });
  it("no voltage, no torque", () => {
    expect(peakTorque({ ...p, voltage: 0 })).toBe(0);
  });
  it("carries through the dead point and averages the steady speed", () => {
    const s = { phi: 0.3, omega: 0 };
    for (let i = 0; i < 40000; i++) stepMotor(s, p, 0.0005);
    let sum = 0;
    const n = 8000;
    for (let i = 0; i < n; i++) sum += stepMotor(s, p, 0.0005).omega;
    expect(sum / n).toBeGreaterThan(steadyOmega(p) * 0.9);
    expect(sum / n).toBeLessThan(steadyOmega(p) * 1.1);
  });
  it("reversing the battery reverses the spin", () => {
    const s = { phi: 0.3, omega: 0 };
    for (let i = 0; i < 20000; i++) stepMotor(s, p, 0.0005, -1);
    expect(s.omega).toBeLessThan(0);
  });
});

describe("animal cell", () => {
  it("keeps its size in an isotonic solution", () => {
    expect(volumeRatio(300)).toBeCloseTo(1, 9);
  });
  it("swells and bursts in dilute water, shrinks in concentrated", () => {
    expect(osmosisState(100).lysed).toBe(true);
    expect(osmosisState(250).ratio).toBeGreaterThan(1);
    expect(osmosisState(600).ratio).toBeLessThan(1);
    expect(osmosisState(600).water).toBe("out of the cell");
  });
  it("makes about 30 ATP per glucose and uses 6 O₂ per glucose", () => {
    const r = respiration(50);
    expect(r.atpPerSec / r.glucosePerSec).toBe(ATP_PER_GLUCOSE);
    expect(r.o2PerSec / r.glucosePerSec).toBe(6);
    expect(respiration(100).atpPerSec).toBeGreaterThan(respiration(0).atpPerSec);
  });
});

describe("electrolysis of water", () => {
  it("hydrogen is twice the oxygen by volume", () => {
    const v = gasVolumes(1.5, 600);
    expect(v.h2mL / v.o2mL).toBeCloseTo(2, 9);
  });
  it("one faraday of charge gives half a mole of hydrogen (12 L at RTP)", () => {
    expect(gasVolumes(1, FARADAY).h2mL).toBeCloseTo(12000, 6);
  });
  it("no current below the decomposition voltage", () => {
    expect(cellCurrent(1.5, 0.5)).toBe(0);
  });
  it("adding electrolyte raises the current", () => {
    expect(cellCurrent(6, 0.5)).toBeGreaterThan(cellCurrent(6, 0.01) * 5);
  });
});
