export const VIMEO_ORIGIN = 'https://player.vimeo.com';

export function vimeoFrame(id: string, at: { t: number; h?: string | null }): string {
  const q = new URLSearchParams({ autoplay: '0', muted: '1', controls: '0', title: '0', byline: '0', portrait: '0', dnt: '1', autopause: '0', background: '0', playsinline: '1', keyboard: '0', pip: '0' });
  if (at.h) q.set('h', at.h);
  return `${VIMEO_ORIGIN}/video/${encodeURIComponent(id)}?${q}#t=${Math.max(0, Math.floor(at.t))}s`;
}

export interface VimeoMsg { event?: string; method?: string; value?: unknown; data?: Record<string, unknown> }

export function vimeoMsg(origin: string, data: unknown): VimeoMsg | null {
  if (origin !== VIMEO_ORIGIN) return null;
  let d = data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return null; } }
  return d && typeof d === 'object' ? (d as VimeoMsg) : null;
}

export interface VmState { t: number | null; at: number; playing: boolean; buffering: boolean; duration: number | null; ended?: boolean }

export type VmStep = { kind: 'none' } | { kind: 'play' } | { kind: 'pause' } | { kind: 'seek'; to: number };

export function vimeoNow(s: VmState, now: number): number | null {
  if (s.t == null) return null;
  return s.playing && !s.buffering ? s.t + Math.max(0, Math.min(1, (now - s.at) / 1000)) : s.t;
}

export function vmStep(s: VmState, want: { t: number; playing: boolean; settling?: boolean; lead?: number }, now: number, over = 0.5): VmStep {
  const to = Math.max(0, want.t);
  if (!want.playing) return s.playing ? { kind: 'pause' } : { kind: 'none' };
  if (s.duration && to >= s.duration - 0.5) return s.playing ? { kind: 'pause' } : { kind: 'none' };
  if (s.buffering || want.settling) return { kind: 'none' };
  const at = vimeoNow(s, now);
  if (at != null && Math.abs(at - to) > over) return { kind: 'seek', to: Math.min(s.duration ? s.duration - 0.5 : Infinity, to + Math.max(0, Math.min(1.5, want.lead ?? 0))) };
  return s.playing && !s.ended ? { kind: 'none' } : { kind: 'play' };
}

export function vimeoLoud(data: Record<string, unknown> | null | undefined): boolean {
  return !!data && (data.muted === false || (typeof data.volume === 'number' && data.volume > 0));
}
