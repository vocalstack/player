export function videoState(v: { ended: boolean; paused: boolean; seeking: boolean; readyState: number }): number {
  if (v.ended) return 0;
  if (v.paused) return 2;
  if (v.seeking || v.readyState < 3) return 3;
  return 1;
}
