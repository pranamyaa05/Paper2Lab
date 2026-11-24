/** Talks to the local AI proxy in server/api.ts. Every call degrades to demo mode if the proxy or key is missing. */
export interface ApiStatus {
  gemini: boolean;
  elevenlabs: boolean;
  model?: string;
}

let statusPromise: Promise<ApiStatus> | null = null;

export function getStatus(): Promise<ApiStatus> {
  statusPromise ??= fetch("/api/v1/status")
    .then((r) => (r.ok ? (r.json() as Promise<ApiStatus>) : { gemini: false, elevenlabs: false }))
    .catch(() => ({ gemini: false, elevenlabs: false }));
  return statusPromise;
}

export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(msg || `Request failed (${r.status})`);
  }
  return (await r.json()) as T;
}
