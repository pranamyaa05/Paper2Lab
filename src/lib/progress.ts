import { useSyncExternalStore } from "react";

/**
 * Which missions a student has completed, remembered in this browser only (localStorage).
 * Nothing leaves the device, and everything still works if storage is blocked (private mode).
 */
export type Progress = Record<string, string[]>;

const KEY = "paper2lab.progress.v1";
const EMPTY: Progress = {};
let cache: Progress | null = null;
const listeners = new Set<() => void>();

function sanitize(raw: unknown): Progress {
  if (!raw || typeof raw !== "object") return {};
  const out: Progress = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = [...new Set(v.filter((x): x is string => typeof x === "string"))];
  }
  return out;
}

function read(): Progress {
  if (cache) return cache;
  try {
    cache = sanitize(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    cache = {};
  }
  return cache;
}

function commit(next: Progress) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: progress lasts until the page is closed
  }
  listeners.forEach((l) => l());
}

/** Record a completed mission. Returns true the first time, false if it was already saved. */
export function markDone(template: string, mission: string): boolean {
  const p = read();
  if (p[template]?.includes(mission)) return false;
  commit({ ...p, [template]: [...(p[template] ?? []), mission] });
  return true;
}

export function clearProgress() {
  commit({});
}

export const totalDone = (p: Progress) => Object.values(p).reduce((n, ids) => n + ids.length, 0);

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep several open tabs in step.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
