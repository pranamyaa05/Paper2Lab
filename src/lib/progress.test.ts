import { beforeEach, describe, expect, it, vi } from "vitest";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

async function load(storage?: ReturnType<typeof fakeStorage> | "broken") {
  vi.resetModules();
  if (storage === "broken") {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
  } else vi.stubGlobal("localStorage", storage ?? fakeStorage());
  return import("./progress");
}

beforeEach(() => vi.unstubAllGlobals());

describe("progress store", () => {
  it("remembers a mission once and saves it", async () => {
    const s = fakeStorage();
    const p = await load(s);
    expect(p.markDone("dc-motor", "fast")).toBe(true);
    expect(p.markDone("dc-motor", "fast")).toBe(false);
    expect(JSON.parse(s.data.get("paper2lab.progress.v1")!)).toEqual({ "dc-motor": ["fast"] });
  });

  it("loads what was saved earlier", async () => {
    const p = await load(fakeStorage({ "paper2lab.progress.v1": JSON.stringify({ neuron: ["speed", "slow"] }) }));
    expect(p.markDone("neuron", "speed")).toBe(false);
    expect(p.markDone("neuron", "threshold")).toBe(true);
  });

  it("ignores corrupt or hostile saved data", async () => {
    const p = await load(fakeStorage({ "paper2lab.progress.v1": '{"a": "nope", "b": [1, "ok", null]}' }));
    expect(p.markDone("b", "ok")).toBe(false);
    expect(p.markDone("a", "x")).toBe(true);
  });

  it("still works when storage is blocked", async () => {
    const p = await load("broken");
    expect(p.markDone("neuron", "speed")).toBe(true);
    expect(p.markDone("neuron", "speed")).toBe(false);
  });

  it("can be cleared", async () => {
    const s = fakeStorage();
    const p = await load(s);
    p.markDone("neuron", "speed");
    p.clearProgress();
    expect(JSON.parse(s.data.get("paper2lab.progress.v1")!)).toEqual({});
    expect(p.markDone("neuron", "speed")).toBe(true);
  });

  it("counts completed missions", async () => {
    const p = await load();
    expect(p.totalDone({ a: ["1", "2"], b: ["3"] })).toBe(3);
  });
});
