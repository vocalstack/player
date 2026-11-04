export interface Span { wallStart: number; wallEnd?: number | null; mediaStart: number }
export interface Gap { at: number; shift: number }

export function spanGaps(spans: readonly Span[]): Gap[] {
  const out: Gap[] = [];
  let shift = 0;
  for (let k = 1; k < spans.length; k++) {
    const before = spans[k - 1];
    shift += Math.max(0, spans[k].wallStart - (before.wallEnd ?? before.wallStart));
    if (shift > 0) out.push({ at: spans[k].mediaStart, shift });
  }
  return out;
}

export function toStream(t: number, base: number, gaps: readonly Gap[]): number {
  let shift = 0;
  for (const g of gaps) if (g.at <= t) shift = g.shift;
  return base + t + shift;
}

export function fromStream(y: number, base: number, gaps: readonly Gap[]): number {
  let shift = 0;
  for (const g of gaps) {
    if (base + g.at + g.shift <= y) shift = g.shift;
    else if (base + g.at + shift <= y) return g.at;
  }
  return y - base - shift;
}
