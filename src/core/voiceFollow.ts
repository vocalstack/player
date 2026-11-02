import { useEffect, useMemo, useRef, useState } from 'react';

export interface FollowLine { sid: number; start: number; end: number }
export interface FollowClip { src: string; part: number; parts: number; durationS?: number | null }

export type FollowTarget =
  | { kind: 'play'; sid: number; src: string; offset: number }
  | { kind: 'missing'; sid: number }
  | { kind: 'done'; sid: number }
  | { kind: 'none' };

export const FOLLOW_DRIFT_S = 0.5;
export const FOLLOW_AHEAD = 3;

export function lineAt(lines: readonly FollowLine[], t: number): number {
  let k = -1;
  for (let i = 0; i < lines.length && lines[i].start <= t + 0.02; i++) k = i;
  return k;
}

export function followTarget(lines: readonly FollowLine[], clips: ReadonlyMap<number, readonly FollowClip[]>, t: number): FollowTarget {
  const k = lineAt(lines, t);
  if (k < 0) return { kind: 'none' };
  const line = lines[k];
  if (t >= line.end) return { kind: 'none' };
  const parts = [...(clips.get(line.sid) ?? [])].sort((a, b) => a.part - b.part);
  if (!parts.length) return { kind: 'missing', sid: line.sid };
  const total = Math.max(1, ...parts.map((p) => p.parts));
  let elapsed = Math.max(0, t - line.start);
  for (let p = 0; p < total; p++) {
    const c = parts.find((x) => x.part === p);
    if (!c) return { kind: 'missing', sid: line.sid };
    const d = c.durationS && c.durationS > 0 ? c.durationS : Infinity;
    if (elapsed < d) return { kind: 'play', sid: line.sid, src: c.src, offset: elapsed };
    elapsed -= d;
  }
  return { kind: 'done', sid: line.sid };
}

export function upcomingSrcs(lines: readonly FollowLine[], clips: ReadonlyMap<number, readonly FollowClip[]>, t: number, n = FOLLOW_AHEAD): string[] {
  const k = Math.max(0, lineAt(lines, t));
  const out: string[] = [];
  for (let i = k; i < lines.length && i <= k + n; i++) {
    const first = (clips.get(lines[i].sid) ?? []).find((c) => c.part === 0);
    if (first) out.push(first.src);
  }
  return out;
}

export interface FollowState { missing: number | null; sid: number | null }

export function useVoiceFollow(o: { on: boolean; lines: readonly FollowLine[]; clips: readonly (FollowClip & { sentenceId: number })[]; t: number; playing: boolean; muted: boolean }): FollowState {
  const bySid = useMemo(() => {
    const m = new Map<number, FollowClip[]>();
    for (const c of o.clips) m.set(c.sentenceId, [...(m.get(c.sentenceId) ?? []), c]);
    return m;
  }, [o.clips]);
  const cache = useRef(new Map<string, HTMLAudioElement>());
  const cur = useRef<{ src: string; el: HTMLAudioElement } | null>(null);
  const [state, setState] = useState<FollowState>({ missing: null, sid: null });
  const el = (src: string) => {
    let a = cache.current.get(src);
    if (!a) {
      a = new Audio();
      a.preload = 'auto';
      a.src = src;
      cache.current.set(src, a);
    }
    return a;
  };
  const stopCurrent = () => { cur.current?.el.pause(); cur.current = null; };
  useEffect(() => () => { for (const a of cache.current.values()) { a.pause(); a.removeAttribute('src'); } cache.current.clear(); cur.current = null; }, []);
  useEffect(() => {
    if (!o.on) { stopCurrent(); setState((s) => (s.missing == null && s.sid == null ? s : { missing: null, sid: null })); return; }
    const want = followTarget(o.lines, bySid, o.t);
    const missing = want.kind === 'missing' ? want.sid : null;
    const sid = want.kind === 'none' ? null : want.sid;
    setState((s) => (s.missing === missing && s.sid === sid ? s : { missing, sid }));
    const keep = new Set(upcomingSrcs(o.lines, bySid, o.t));
    for (const src of keep) el(src);
    const c = cur.current;
    if (c) keep.add(c.src);
    for (const [src, a] of cache.current) if (!keep.has(src) && (!c || c.el !== a)) { a.pause(); cache.current.delete(src); }
    if (!o.playing) { c?.el.pause(); return; }
    if (want.kind !== 'play') {
      const stillSpeaking = c && !c.el.paused && !c.el.ended;
      if (stillSpeaking && want.kind !== 'none') return;
      if (!stillSpeaking) cur.current = null;
      return;
    }
    if (c && c.src === want.src) {
      c.el.muted = o.muted;
      if (!c.el.ended && Math.abs(c.el.currentTime - want.offset) > FOLLOW_DRIFT_S) { try { c.el.currentTime = want.offset; } catch { } }
      if (c.el.paused && !c.el.ended) void c.el.play().catch(() => {});
      return;
    }
    c?.el.pause();
    const a = el(want.src);
    a.muted = o.muted;
    try { a.currentTime = want.offset; } catch { }
    cur.current = { src: want.src, el: a };
    void a.play().catch(() => {});
  }, [o.on, o.t, o.playing, o.muted, o.lines, bySid]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
