export const STARTING_DEFAULT_MS = 3_000;

export function startingRetryMs(status: number, retryAfter: string | null, body: unknown): number | null {
  if (status !== 503) return null;
  const ra = retryAfter == null || retryAfter.trim() === '' ? NaN : Number(retryAfter);
  if (Number.isFinite(ra)) return Math.min(15_000, Math.max(1_000, ra * 1000));
  const b = body as { retryable?: unknown; code?: unknown } | null;
  if (b && (b.retryable === true || b.code === 'engine_unavailable')) return STARTING_DEFAULT_MS;
  return null;
}

export const CLIP_RETRIES = 4;
export const CLIP_RETRY_MS = 1200;
export const CLIP_STARTING_MS = 300_000;

export interface ClipCheck { ready: boolean; again: boolean; afterMs: number | null }

export async function checkClip(src: string): Promise<ClipCheck> {
  try {
    const r = await fetch(src, { method: 'GET' });
    const body = r.status === 503 ? await r.json().catch(() => null) : null;
    return { ready: r.ok, again: r.status === 202 || r.status === 503 || r.status === 429, afterMs: startingRetryMs(r.status, r.headers.get('Retry-After'), body) };
  } catch {
    return { ready: false, again: true, afterMs: null };
  }
}

export type ClipStep =
  | { kind: 'ready' }
  | { kind: 'drop' }
  | { kind: 'starting'; since: number; ms: number }
  | { kind: 'gaveUp' }
  | { kind: 'retry'; ms: number };

export function clipStep(c: ClipCheck, since: number | null | undefined, tries: number, now: number): ClipStep {
  if (c.ready) return { kind: 'ready' };
  if (!c.again) return { kind: 'drop' };
  if (c.afterMs != null) {
    const s = since ?? now;
    return now - s < CLIP_STARTING_MS ? { kind: 'starting', since: s, ms: c.afterMs } : { kind: 'gaveUp' };
  }
  return { kind: 'retry', ms: CLIP_RETRY_MS * (tries + 1) };
}
