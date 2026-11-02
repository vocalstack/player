export const SUB_LEAD_S = 0.3;
export const SUB_LINGER_S = 1.5;

export interface Timed { start: number; end?: number; words: { start: number; end: number }[] }

export function lineSpeechEnd(r: Timed, next: Timed | undefined, fallback: number): number {
  const w = r.words[r.words.length - 1]?.end;
  if (w != null && w > r.start) return w;
  if (r.end != null && r.end > r.start) return r.end;
  return next?.start ?? fallback;
}

export function subtitleShown(rows: Timed[], i: number, t: number): boolean {
  const r = rows[i];
  if (!r) return false;
  const from = (r.words[0]?.start ?? r.start) - SUB_LEAD_S;
  const next = rows[i + 1];
  const end = lineSpeechEnd(r, next, r.start + 4) + SUB_LINGER_S;
  const until = next ? Math.min(end, (next.words[0]?.start ?? next.start) - SUB_LEAD_S) : end;
  return t >= from && t < Math.max(until, from + 0.5);
}

export function spreadWords(tokens: string[], from: number, to: number): { text: string; start: number; end: number }[] {
  const span = Math.max(0, to - from);
  const weight = tokens.map((w) => Math.max(1, [...w.replace(/[^\p{L}\p{N}]/gu, '')].length));
  const total = weight.reduce((a, b) => a + b, 0) || 1;
  let at = from;
  return tokens.map((text, k) => {
    const start = at;
    at += (span * weight[k]) / total;
    return { text, start, end: at };
  });
}
