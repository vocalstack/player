export const STARTING_DEFAULT_MS = 3_000;

export function startingRetryMs(status: number, retryAfter: string | null, body: unknown): number | null {
  if (status !== 503) return null;
  const ra = retryAfter == null || retryAfter.trim() === '' ? NaN : Number(retryAfter);
  if (Number.isFinite(ra)) return Math.min(15_000, Math.max(1_000, ra * 1000));
  const b = body as { retryable?: unknown; code?: unknown } | null;
  if (b && (b.retryable === true || b.code === 'engine_unavailable')) return STARTING_DEFAULT_MS;
  return null;
}
