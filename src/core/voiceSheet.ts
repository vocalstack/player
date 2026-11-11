export function nextSelection(current: number | null, clicked: number): number | null {
  return clicked === current ? null : clicked;
}
