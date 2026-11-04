export interface FindRow { id: string; text: string; translations?: Record<string, string> }

export function findMatches(rows: FindRow[], q: string, lang?: string | null): number[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const out: number[] = [];
  rows.forEach((r, i) => {
    const tr = lang ? r.translations?.[lang] : undefined;
    if (r.text.toLowerCase().includes(needle) || (!!tr && tr.toLowerCase().includes(needle))) out.push(i);
  });
  return out;
}

export function stepMatch(at: number, total: number, dir: 1 | -1): number {
  if (total <= 0) return -1;
  if (at < 0 || at >= total) return dir > 0 ? 0 : total - 1;
  return (at + dir + total) % total;
}

export function matchAt(rows: FindRow[], matches: number[], id: string | null): number {
  if (!matches.length) return -1;
  const i = id == null ? -1 : matches.findIndex((m) => rows[m]?.id === id);
  return i >= 0 ? i : 0;
}

export function findCount(at: number, total: number): string {
  return total > 0 ? `${Math.max(0, at) + 1} / ${total}` : '0 found';
}
