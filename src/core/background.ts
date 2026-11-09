import { useEffect, useRef, useState } from 'react';

export type BedState = 'off' | 'making' | 'ready' | 'unavailable';

export const BED_DRIFT_S = 0.3;

export interface BedMedia {
  currentTime: number;
  paused: boolean;
  muted: boolean;
  play: () => Promise<void> | void;
  pause: () => void;
}

export function followBed(a: BedMedia, want: { t: number; playing: boolean; muted: boolean }): void {
  a.muted = want.muted;
  if (Math.abs(a.currentTime - want.t) > BED_DRIFT_S) a.currentTime = Math.max(0, want.t);
  if (want.playing) {
    if (a.paused) void Promise.resolve(a.play()).catch(() => {});
  } else if (!a.paused) a.pause();
}

export const REMOVE_BG_LABEL = 'Remove background sound';
export const REMOVE_BG_NOTE = "Takes out everything that isn't speech: music, ambience and noise.";

function clockOf(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function bedNote(on: boolean, state: BedState, what: 'transcription' | 'video' = 'transcription', untilS = 0): string {
  if (state === 'unavailable') return `Not available for this ${what}`;
  if (state === 'making') return untilS > 0 ? `Separating the speech from the background… ready up to ${clockOf(untilS)}` : 'Separating the speech from the background…';
  return REMOVE_BG_NOTE;
}

export interface TrackPlan {
  bed: boolean;
  speech: boolean;
}

export function trackPlan(removeBg: boolean, voiceOn: boolean, originalRow = false): TrackPlan {
  return { bed: voiceOn && !removeBg && !originalRow, speech: removeBg && (!voiceOn || originalRow) };
}

export function originalSound(removeBg: boolean, speech: BedState): 'speech' | 'source' {
  return removeBg && speech === 'ready' ? 'speech' : 'source';
}

export function removeBgOf(stored: boolean | null, oldKeep: boolean | null): boolean {
  if (typeof stored === 'boolean') return stored;
  return oldKeep === false;
}

export function removeBgFromQuery(q: URLSearchParams): boolean {
  const v = q.get('bg');
  return v === 'off' || v === 'remove';
}

export function withRemoveBg(u: URL, removeBg: boolean): void {
  if (removeBg) u.searchParams.set('bg', 'remove'); else u.searchParams.delete('bg');
}

export function bedRetryS(status: number, body: unknown): number | null {
  if (status !== 503) return null;
  const s = (body as { data?: { details?: { retryAfterS?: unknown } } } | null)?.data?.details?.retryAfterS;
  return typeof s === 'number' && s > 0 ? Math.max(2, s) : 3;
}

export interface SepPart {
  startS: number;
  endS: number;
  url: string;
}

export const SEAM_S = 0.05;

export function partsOf(body: unknown): { untilS: number; parts: SepPart[] } {
  const d = (body as { data?: { details?: { parts?: unknown } } } | null)?.data?.details?.parts;
  const parts: SepPart[] = [];
  if (Array.isArray(d)) {
    for (const x of d as Array<Partial<SepPart>>) {
      if (!x || typeof x.startS !== 'number' || typeof x.endS !== 'number' || typeof x.url !== 'string' || !(x.endS > x.startS)) break;
      const at = parts.length ? parts[parts.length - 1].endS : 0;
      if (Math.abs(x.startS - at) > 0.01) break;
      parts.push({ startS: x.startS, endS: x.endS, url: x.url });
    }
  }
  return { untilS: parts.length ? parts[parts.length - 1].endS : 0, parts };
}

export function partAt(parts: SepPart[], t: number): number {
  if (!parts.length || t < 0 || t >= parts[parts.length - 1].endS - SEAM_S) return -1;
  let lo = 0;
  let hi = parts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (parts[mid].startS <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function slotsFor(parts: SepPart[], i: number, held: [number, number], cur: 0 | 1): { play: 0 | 1; load: Array<[0 | 1, number]> } {
  const want = parts[i].startS;
  const play: 0 | 1 = held[cur] === want ? cur : held[1 - cur] === want ? ((1 - cur) as 0 | 1) : cur;
  const load: Array<[0 | 1, number]> = [];
  if (held[play] !== want) load.push([play, i]);
  const other = (1 - play) as 0 | 1;
  if (i + 1 < parts.length && held[other] !== parts[i + 1].startS) load.push([other, i + 1]);
  return { play, load };
}

type Probe = { ready: true } | { ready: false; retryS: number | null; untilS: number; parts: SepPart[] };

async function probe(url: string): Promise<Probe> {
  const r = await fetch(url, { redirect: 'manual', credentials: 'omit' });
  if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400) || r.ok) return { ready: true };
  const body = await r.json().catch(() => null);
  return { ready: false, retryS: bedRetryS(r.status, body), ...partsOf(body) };
}

export interface Separated {
  state: BedState;
  on: boolean;
  untilS: number;
}

type Want = { t: number; playing: boolean; muted: boolean };

function release(a: HTMLAudioElement | null): void {
  if (!a) return;
  a.pause();
  a.removeAttribute('src');
  a.load();
}

export function useSeparatedTrack(url: string | null, want: Want): Separated {
  const [state, setState] = useState<BedState>('off');
  const [parts, setParts] = useState<SepPart[]>([]);
  const [on, setOn] = useState(false);
  const full = useRef<HTMLAudioElement | null>(null);
  const els = useRef<[HTMLAudioElement | null, HTMLAudioElement | null]>([null, null]);
  const held = useRef<[number, number]>([NaN, NaN]);
  const cur = useRef<0 | 1>(0);
  useEffect(() => {
    setParts([]);
    setOn(false);
    if (!url) { setState('off'); return; }
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState('making');
    const check = () => {
      probe(url).then((r) => {
        if (stop) return;
        if (r.ready) {
          const a = new Audio();
          a.preload = 'auto';
          const done = () => { if (!stop && full.current === a) setState('ready'); };
          a.addEventListener('canplay', done, { once: true });
          a.addEventListener('error', done, { once: true });
          a.src = url;
          full.current = a;
          return;
        }
        if (r.retryS == null) { setState('unavailable'); setParts([]); return; }
        setParts((old) => (old.length === r.parts.length && old.every((p, i) => p.startS === r.parts[i].startS) ? old : r.parts));
        timer = setTimeout(check, r.retryS * 1000);
      }).catch(() => { if (!stop) timer = setTimeout(check, 5000); });
    };
    check();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      release(full.current);
      full.current = null;
      release(els.current[0]);
      release(els.current[1]);
      els.current = [null, null];
      held.current = [NaN, NaN];
    };
  }, [url]);
  useEffect(() => {
    const pauseParts = () => { for (const a of els.current) if (a && !a.paused) a.pause(); };
    if (state === 'ready' && full.current) {
      pauseParts();
      followBed(full.current, want);
      setOn(true);
      return;
    }
    const i = state === 'making' ? partAt(parts, want.t) : -1;
    if (i < 0) { pauseParts(); setOn(false); return; }
    const plan = slotsFor(parts, i, held.current, cur.current);
    for (const [slot, n] of plan.load) {
      let a = els.current[slot];
      if (!a) { a = new Audio(); a.preload = 'auto'; els.current[slot] = a; }
      a.pause();
      a.src = parts[n].url;
      held.current[slot] = parts[n].startS;
    }
    cur.current = plan.play;
    const a = els.current[plan.play]!;
    const other = els.current[(1 - plan.play) as 0 | 1];
    if (other && !other.paused) other.pause();
    followBed(a, { ...want, t: want.t - parts[i].startS });
    setOn(!want.playing || a.readyState >= 3);
  }, [state, parts, want.t, want.playing, want.muted]); // eslint-disable-line react-hooks/exhaustive-deps
  return { state, on, untilS: state === 'ready' ? Infinity : parts.length ? parts[parts.length - 1].endS : 0 };
}

export function useBackgroundBed(url: string | null, want: Want): BedState {
  return useSeparatedTrack(url, want).state;
}
