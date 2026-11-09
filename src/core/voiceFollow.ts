import { useEffect, useMemo, useRef, useState } from 'react';

export interface FollowWord { start: number; end: number; text?: string }
export interface FollowLine { sid: number; start: number; end: number; words?: readonly FollowWord[] }
export type FollowTimes = Readonly<Record<string, readonly (readonly [number, number])[]>>;
export interface FollowClip { src: string; part: number; parts: number; durationS?: number | null }

export type FollowTarget =
  | { kind: 'play'; sid: number; src: string; offset: number }
  | { kind: 'missing'; sid: number }
  | { kind: 'original'; sid: number }
  | { kind: 'done'; sid: number }
  | { kind: 'none' };

export const FOLLOW_DRIFT_S = 0.5;
export const FOLLOW_AHEAD = 3;
export const FOLLOW_JUMP_S = 1.5;

export function lineAt(lines: readonly FollowLine[], t: number): number {
  let k = -1;
  for (let i = 0; i < lines.length && lines[i].start <= t + 0.02; i++) k = i;
  return k;
}

export function clipTimeAt(line: FollowLine, t: number, totalS: number | null, times?: readonly (readonly [number, number])[]): number {
  const ws = line.words ?? [];
  let j = -1;
  for (let k = 0; k < ws.length; k++) if (ws[k].start <= t + 0.02) j = k;
  if (j < 0) return Math.max(0, t - line.start);
  const w = ws[j];
  const into = w.end > w.start ? Math.max(0, Math.min(1, (t - w.start) / (w.end - w.start))) : 0;
  if (times && times.length === ws.length) return times[j][0] + into * (times[j][1] - times[j][0]);
  if (totalS == null || j === 0 && into === 0) return Math.max(0, t - line.start);
  const len = (x: FollowWord) => Math.max(1, (x.text ?? '').trim().length);
  let all = 0;
  let before = 0;
  for (let k = 0; k < ws.length; k++) { all += len(ws[k]); if (k < j) before += len(ws[k]); }
  return ((before + into * len(w)) / all) * totalS;
}

export function followTarget(lines: readonly FollowLine[], clips: ReadonlyMap<number, readonly FollowClip[]>, t: number, times?: FollowTimes, original?: ReadonlySet<number>): FollowTarget {
  const k = lineAt(lines, t);
  if (k < 0) return { kind: 'none' };
  const line = lines[k];
  if (t >= line.end) return { kind: 'none' };
  if (original?.has(line.sid)) return { kind: 'original', sid: line.sid };
  const parts = [...(clips.get(line.sid) ?? [])].sort((a, b) => a.part - b.part);
  if (!parts.length) return { kind: 'missing', sid: line.sid };
  const total = Math.max(1, ...parts.map((p) => p.parts));
  const durs = Array.from({ length: total }, (_, p) => parts.find((x) => x.part === p)?.durationS ?? null);
  const totalS = durs.every((d) => d != null && d > 0) ? durs.reduce<number>((a, d) => a + (d ?? 0), 0) : null;
  let elapsed = clipTimeAt(line, t, totalS, total === 1 ? times?.[String(line.sid)] : undefined);
  for (let p = 0; p < total; p++) {
    const c = parts.find((x) => x.part === p);
    if (!c) return { kind: 'missing', sid: line.sid };
    const d = c.durationS && c.durationS > 0 ? c.durationS : Infinity;
    if (elapsed < d) return { kind: 'play', sid: line.sid, src: c.src, offset: elapsed };
    elapsed -= d;
  }
  return { kind: 'done', sid: line.sid };
}

export function mayRunOn(lines: readonly FollowLine[], t: number, playingSid: number | null): boolean {
  if (playingSid == null) return false;
  const k = lineAt(lines, t);
  if (k < 0) return false;
  const line = lines[k];
  if (t >= line.end) return line.sid === playingSid;
  return k > 0 && lines[k - 1].sid === playingSid && t - line.start < 1.5;
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

export interface FollowState { missing: number | null; sid: number | null; original: boolean }

export function useVoiceFollow(o: { on: boolean; lines: readonly FollowLine[]; clips: readonly (FollowClip & { sentenceId: number })[]; t: number; playing: boolean; muted: boolean; times?: FollowTimes; original?: ReadonlySet<number> }): FollowState {
  const bySid = useMemo(() => {
    const m = new Map<number, FollowClip[]>();
    for (const c of o.clips) m.set(c.sentenceId, [...(m.get(c.sentenceId) ?? []), c]);
    return m;
  }, [o.clips]);
  const cache = useRef(new Map<string, HTMLAudioElement>());
  const cur = useRef<{ src: string; sid: number; el: HTMLAudioElement; t: number; at: number; last: number } | null>(null);
  const [state, setState] = useState<FollowState>({ missing: null, sid: null, original: false });
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
    if (!o.on) { stopCurrent(); setState((s) => (s.missing == null && s.sid == null && !s.original ? s : { missing: null, sid: null, original: false })); return; }
    const want = followTarget(o.lines, bySid, o.t, o.times, o.original);
    const missing = want.kind === 'missing' ? want.sid : null;
    const sid = want.kind === 'none' ? null : want.sid;
    const c0 = cur.current;
    const runsOn = want.kind === 'original' && !!c0 && o.playing && !c0.el.paused && !c0.el.ended && mayRunOn(o.lines, o.t, c0.sid);
    const original = want.kind === 'original' && !runsOn;
    setState((s) => (s.missing === missing && s.sid === sid && s.original === original ? s : { missing, sid, original }));
    const keep = new Set(upcomingSrcs(o.lines, bySid, o.t));
    for (const src of keep) el(src);
    const c = cur.current;
    if (c) keep.add(c.src);
    for (const [src, a] of cache.current) if (!keep.has(src) && (!c || c.el !== a)) { a.pause(); cache.current.delete(src); }
    if (!o.playing) { c?.el.pause(); return; }
    if (want.kind !== 'play') {
      const stillSpeaking = c && !c.el.paused && !c.el.ended;
      if (stillSpeaking && mayRunOn(o.lines, o.t, c.sid)) return;
      if (c) c.el.pause();
      cur.current = null;
      return;
    }
    if (c && c.src === want.src) {
      c.el.muted = o.muted;
      const jumped = Math.abs(o.t - c.last) > FOLLOW_JUMP_S;
      c.last = o.t;
      if (jumped) { c.t = o.t; c.at = want.offset; }
      const expect = c.at + (o.t - c.t);
      if (!c.el.ended && Math.abs(c.el.currentTime - expect) > FOLLOW_DRIFT_S) { try { c.el.currentTime = expect; } catch { } }
      if (c.el.paused && !c.el.ended) void c.el.play().catch(() => {});
      return;
    }
    c?.el.pause();
    const a = el(want.src);
    a.muted = o.muted;
    try { a.currentTime = want.offset; } catch { }
    cur.current = { src: want.src, sid: want.sid, el: a, t: o.t, at: want.offset, last: o.t };
    void a.play().catch(() => {});
  }, [o.on, o.t, o.playing, o.muted, o.lines, bySid, o.original]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

export type PlaybackClock = 'video' | 'audio' | 'clips';

export function playbackClock(videoLed: boolean, audio: boolean): PlaybackClock {
  return videoLed ? 'video' : audio ? 'audio' : 'clips';
}
