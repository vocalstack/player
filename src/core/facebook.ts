import { vmStep, type VmState, type VmStep } from './vimeo';

export interface FbState extends VmState { seen: number | null }

export const FB_TICK = 0.5;

export function fbState(): FbState {
  return { t: null, at: 0, playing: false, buffering: false, duration: null, seen: null };
}

export function fbSample(s: FbState, pos: number, now: number): void {
  if (!Number.isFinite(pos)) return;
  if (s.seen === pos) return;
  s.seen = pos;
  s.t = pos;
  s.at = now;
}

export function fbNow(s: FbState, now: number): number | null {
  if (s.t == null) return null;
  return s.playing && !s.buffering ? s.t + Math.max(0, Math.min(FB_TICK, (now - s.at) / 1000)) : s.t;
}

export function fbStep(s: FbState, want: { t: number; playing: boolean; settling?: boolean; lead?: number }, now: number, over = 0.5): VmStep {
  return vmStep({ ...s, t: fbNow(s, now), at: now }, want, now, over);
}

export function fbFit(box: { w: number; h: number }, frame: { w: number; h: number }): { scale: number; w: number; h: number } {
  if (!(box.w > 0 && box.h > 0 && frame.w > 0 && frame.h > 0)) return { scale: 1, w: frame.w, h: frame.h };
  const scale = Math.min(box.w / frame.w, box.h / frame.h);
  return { scale, w: frame.w * scale, h: frame.h * scale };
}

export function fbWidth(box: number, screen: number): number {
  return Math.round(Math.max(320, Math.min(1920, Math.max(box, screen))));
}
