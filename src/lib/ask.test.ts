import { describe, expect, it } from "vitest";
import { defaultValues, specFromTemplate } from "@/labs/templates";
import { localAnswer } from "./ask";

describe("demo tutor", () => {
  const pulley = specFromTemplate("pulley-incline");
  const v = defaultValues(pulley);

  it("explains a named part and lights it up", () => {
    const a = localAnswer(pulley, v, "What does the pulley do?");
    expect(a.highlight).toBe("pulley");
    expect(a.answer).toMatch(/direction/);
  });

  it("runs a what-if with an exact number", () => {
    const a = localAnswer(pulley, v, "What if the angle is 45 degrees?");
    expect(a.set).toEqual({ theta: 45 });
    expect(a.answer).toMatch(/45/);
  });

  it("increases or decreases by words", () => {
    expect(localAnswer(pulley, v, "make the friction higher").set?.mu).toBeGreaterThan(v.mu!);
    expect(localAnswer(pulley, v, "what if the hanging mass is lighter?").set?.m).toBeLessThan(v.m!);
  });

  it("switches a toggle off", () => {
    const neuron = specFromTemplate("neuron");
    const a = localAnswer(neuron, defaultValues(neuron), "what happens without myelin?");
    expect(a.set).toEqual({ myelin: 0 });
    expect(a.answer).toMatch(/Conduction speed/);
  });

  it("keeps values inside the slider range", () => {
    const motor = specFromTemplate("dc-motor");
    expect(localAnswer(motor, defaultValues(motor), "set the voltage to 99").set?.voltage).toBe(12);
  });
});

import { guessTemplate } from "@/labs/templates";

describe("file-name matching", () => {
  it("matches whole words only", () => {
    expect(guessTemplate("photo-0412.png")).toBeNull();
    expect(guessTemplate("IMG_2041.jpg")).toBeNull();
  });
  it("still recognises concept names", () => {
    expect(guessTemplate("dc_motor_diagram.png")?.id).toBe("dc-motor");
    expect(guessTemplate("Neurons chapter 7.jpg")?.id).toBe("neuron");
    expect(guessTemplate("electrolysis-of-water.png")?.id).toBe("electrolysis");
    expect(guessTemplate("pH indicator.png")?.id).toBe("phenolphthalein");
  });
});

describe("local-first answers", () => {
  const pulley = specFromTemplate("pulley-incline");
  const v = defaultValues(pulley);
  it("is confident about simple part questions and what-ifs", () => {
    expect(localAnswer(pulley, v, "What does the pulley do?").confident).toBe(true);
    expect(localAnswer(pulley, v, "what if the angle is 45?").confident).toBe(true);
  });
  it("leaves open-ended questions for the AI", () => {
    expect(localAnswer(pulley, v, "Why does the pulley not change the tension?").confident).toBeFalsy();
    expect(localAnswer(pulley, v, "How is this used in an elevator?").confident).toBeFalsy();
  });
});

import { sanitizeActions } from "./ask";

describe("tutor actions", () => {
  const pulley = specFromTemplate("pulley-incline");
  const v = defaultValues(pulley);
  it("a part question highlights the part and points the camera at it", () => {
    expect(localAnswer(pulley, v, "What does the pulley do?").actions).toEqual([
      { type: "highlight", part: "pulley" },
      { type: "focus", part: "pulley" },
    ]);
  });
  it("a what-if changes the slider", () => {
    expect(localAnswer(pulley, v, "what if the angle is 45?").actions).toContainEqual({ type: "set", param: "theta", value: 45 });
  });
  it("can turn the model around", () => {
    expect(localAnswer(pulley, v, "show me all sides").actions).toEqual([{ type: "rotate" }]);
  });
  it("drops actions that name parts, sliders or demos the lab doesn't have", () => {
    const out = sanitizeActions(pulley, [
      { type: "highlight", part: "rocket" },
      { type: "focus", part: "pulley" },
      { type: "set", param: "theta", value: 500 },
      { type: "set", param: "warp", value: 1 },
      { type: "trigger", action: "explode" },
      { type: "trigger", action: "restart" },
    ]);
    expect(out).toEqual([
      { type: "focus", part: "pulley" },
      { type: "set", param: "theta", value: 60 },
      { type: "trigger", action: "restart" },
    ]);
  });
});
