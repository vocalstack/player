export function lastOfGroup(heads: readonly string[], head: string): number {
  for (let i = heads.length - 1; i >= 0; i--) if (heads[i] === head) return i;
  return -1;
}

export function speakerExtra<S, N>(hook: ((sp: S) => N | null | undefined) | undefined, sp: S | null | undefined): N | null {
  if (!hook || sp == null) return null;
  return hook(sp) ?? null;
}

export function underAt(heads: readonly string[], head: string, has: boolean): number | null {
  if (!has) return null;
  return lastOfGroup(heads, head);
}
