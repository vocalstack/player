export function sampleDelay(attempt: number): number {
  return Math.min(10_000, 2000 * 1.5 ** attempt);
}
