import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import type { Correction, LanguageLists } from '@vocalstack/js-sdk';
import { LanguageChip, Sheet, Switch } from '../ds/Controls';
import { D, Icon, PlayGlyph, Spinner } from '../ds/Icons';
import { isNotCaptured } from '../core/noAudio';
import { pickerLanguages, useRecentLangs } from '../data/prefs';
import { useVoicePreview } from '../data/voicePreview';
import { LanguagePicker } from '../ds/LanguagePicker';
import { explainAudioError, mediaErrorText, reportMediaError, type MediaCred } from '../core/audio';
import { clock } from '../core/format';
import { describe, useAsync, type ErrorLike } from '../data/transcript';
import { usePlayerApi } from '../data/context';
import { strings } from '../data/i18n';
import { confClass, fixedSlots, lane, speakerInitial, speakerLabel, speakerLook, type Model, type Row, type Word } from '../core/transcript';
import { ClipQueue, newMediaElement, readCursor, VoiceNotStarted, type ReadPos, type VoiceClip } from '../core/voiceplayer';
import { placePosition, snapPosition, type PlayPos } from '../core/playPosition';
import { findCount, findMatches, matchAt, stepMatch } from '../core/find';
import { voiceWait, VOICE_WAIT_TITLE } from '../core/voiceWait';
import { useHeld } from './wait';
import { lineSpeechEnd, spreadWords } from '../core/readalong';
import { type AvailableVoice, type CastMember, FixBadges, FixPen, rowFixes, FeedBar, NO_VOICE_TIP, feedInset, SpeakerCast, VoiceIdGlyph, VoiceSheetBody, autoCast, castKey, langMeta, namedCount, rowKey, speakerRoster, useArchiveVoice, useFeedBar, useVoiceCatalogue, useDragScroll } from './shared';

export function lineWords(rows: Row[], i: number, lang?: string | null): Word[] {
  const r = rows[i];
  const tr = lang && r.translations[lang] && r.language !== lang ? r.translations[lang] : null;
  if (!tr && r.words.length) return r.words;
  const ws = (tr ?? r.text).split(/\s+/).filter(Boolean);
  const from = r.words[0]?.start ?? r.start;
  const to = lineSpeechEnd(r, rows[i + 1], r.start + Math.max(2, ws.length * 0.4));
  return spreadWords(ws, from, to).map((w, k) => ({ ...w, seq: r.seqs[0] ?? 0, idx: k } as Word));
}

export function spokenWordOf(player: Pick<TxPlayer, 't' | 'idx' | 'engaged' | 'wordSync' | 'clipPos'>, i: number, words: Word[]): number | null {
  if (!player.engaged || i !== player.idx || !words.length) return null;
  if (!player.wordSync) return player.clipPos ? readCursor(words.map((w) => ({ t: w.text, sp: ' ' })), player.clipPos) : null;
  const t = player.t;
  let at = -1;
  for (let j = 0; j < words.length && words[j].start <= t; j++) at = j;
  return at;
}

export function pictureT(player: Pick<TxPlayer, 't' | 'idx' | 'wordSync' | 'clipPos' | 'dur' | 'timed'>, rows: Row[]): number {
  const cp = player.clipPos;
  if (player.wordSync || player.timed || !cp || !(cp.dur > 0)) return player.t;
  const r = rows[player.idx];
  const from = r?.start ?? player.t;
  const next = rows[player.idx + 1]?.start ?? lineEnd(r, from, player.dur);
  const span = Math.max(0, next - from);
  return from + Math.min(span, (cp.t / cp.dur) * span);
}

export function lineEnd(r: Row | undefined, from: number, dur: number): number {
  const w = r?.words[r.words.length - 1]?.end;
  if (w != null && w > from) return w;
  if (r?.end != null && r.end > from) return r.end;
  return dur > from ? dur : from + 4;
}

export interface YtLead { muted: boolean; onInfo: (i: { t?: number; state?: number; ready?: boolean; muted?: boolean }) => void; bind: (cmd: ((func: string, args?: unknown[]) => void) | null) => void }

export function YtFollow({ busy = false, ytId, title, t, playing: wantPlay, seekN, onToggle, onAd, endT, onGone, onKnown, lead, onTime, waiting = false }: { busy?: boolean; waiting?: boolean; onTime?: (t: number) => void; lead?: YtLead; ytId: string; title: string; t: number; playing: boolean; seekN: number; onToggle?: () => void; onAd?: (on: boolean) => void; endT?: number | null; onGone?: () => void; onKnown?: (gone: boolean) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!waiting) { setHeld(false); return; }
    const h = setTimeout(() => setHeld(true), 300);
    return () => clearTimeout(h);
  }, [waiting]);
  const playing = wantPlay && !held;
  const adRef = useRef(false);
  const [ad, setAd] = useState(false);
  const apiUp = useRef(false);
  const queued = useRef<[string, unknown[]][]>([]);
  const cmd = (func: string, args: unknown[] = []) => {
    if (adRef.current && (func === 'pauseVideo' || func === 'seekTo' || func === 'setPlaybackRate')) return;
    if (!apiUp.current) { queued.current = [...queued.current.filter(([f]) => f !== func), [func, args]]; return; }
    try { ref.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch { }
  };
  const contentDur = useRef<number | null>(null);
  const liveVideo = useRef(false);
  const adByDur = useRef(false);
  const adByStall = useRef(false);
  const toggleRef = useRef(onToggle); toggleRef.current = onToggle;
  const leadRef = useRef(lead); leadRef.current = lead;
  const adCb = useRef(onAd); adCb.current = onAd;
  const resumeAfterAd = useRef(false);
  const adCheck = () => {
    const now = adByDur.current || adByStall.current;
    if (now === adRef.current) return;
    adRef.current = now;
    setAd(now);
    adCb.current?.(now);
    if (now) {
      cmd('playVideo');
      if (leadRef.current) return;
      if (playingRef.current && toggleRef.current) { resumeAfterAd.current = true; toggleRef.current(); }
    } else if (resumeAfterAd.current && !leadRef.current) {
      resumeAfterAd.current = false;
      if (!playingRef.current) toggleRef.current?.();
    }
  };
  const tRef = useRef(t); tRef.current = t;
  const timeCb = useRef(onTime); timeCb.current = onTime;
  const ytT = useRef<number | null>(null);
  const ytState = useRef<number | null>(null);
  const [ytPaused, setYtPaused] = useState(true);
  const [ready, setReady] = useState(false);
  const noCaptions = () => { cmd('unloadModule', ['captions']); cmd('unloadModule', ['cc']); };
  const capT = useRef<number[]>([]);
  const noCaptionsSoon = () => { noCaptions(); capT.current.forEach(clearTimeout); capT.current = [400, 1200, 2500, 5000].map((ms) => window.setTimeout(noCaptions, ms)); };
  useEffect(() => () => capT.current.forEach(clearTimeout), []);
  const hello = useRef<number | undefined>(undefined);
  useEffect(() => { apiUp.current = false; queued.current = []; return () => window.clearInterval(hello.current); }, [ytId]);
  const onLoad = () => {
    const say = () => { try { ref.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'reader' }), '*'); } catch { } };
    say();
    window.clearInterval(hello.current);
    let n = 0;
    hello.current = window.setInterval(() => { if (apiUp.current || ++n > 40) { window.clearInterval(hello.current); return; } say(); }, 250);
    if (!leadRef.current || leadRef.current.muted) cmd('mute');
    setReady(true);
  };
  useEffect(() => { lead?.bind(cmd); return () => lead?.bind(null); }, [!!lead]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!lead && ready) cmd('mute'); }, [!!lead]); // eslint-disable-line react-hooks/exhaustive-deps
  const win = useRef<{ start: number; end: number } | null>(null);
  const endRef = useRef(endT); endRef.current = endT;
  const playingRef = useRef(playing); playingRef.current = playing;
  const probed = useRef(false);
  const goneRef = useRef(onGone); goneRef.current = onGone;
  const knownRef = useRef(onKnown); knownRef.current = onKnown;
  const goneSaid = useRef(false);
  const [gone, setGone] = useState(false);
  const outside = (x: number) => { const w = win.current; return !!w && (x < w.start - 1 || x > w.end + 5); };
  const seek = () => { if (!outside(tRef.current)) cmd('seekTo', [tRef.current, true]); };
  const at = () => ytT.current;
  useEffect(() => {
    const on = (m: MessageEvent) => {
      if (m.source !== ref.current?.contentWindow || typeof m.data !== 'string') return;
      let d: { event?: string; info?: { currentTime?: number; duration?: number; videoData?: { isLive?: boolean }; muted?: boolean; playerState?: number; progressState?: { seekableStart?: number; seekableEnd?: number } | null } } | null = null;
      try { d = JSON.parse(m.data); } catch { return; }
      if (d?.info?.videoData?.isLive) liveVideo.current = true;
      const dur = d?.info?.duration;
      if (typeof dur === 'number' && dur > 0 && !liveVideo.current) {
        if (contentDur.current == null) contentDur.current = dur;
        else { adByDur.current = Math.abs(dur - contentDur.current) > 1.5; adCheck(); }
      }
      if (d?.event === 'onReady' && !apiUp.current) { apiUp.current = true; const q = queued.current; queued.current = []; for (const [f, a] of q) cmd(f, a); }
      if (d?.event === 'onReady') { if (!leadRef.current || leadRef.current.muted) cmd('mute'); noCaptionsSoon(); leadRef.current?.onInfo({ ready: true }); }
      if (typeof d?.info?.playerState === 'number') { if (d.info.playerState !== ytState.current && (d.info.playerState === 1 || d.info.playerState === 2)) noCaptionsSoon(); ytState.current = d.info.playerState; setYtPaused(d.info.playerState !== 1 && d.info.playerState !== 3); leadRef.current?.onInfo({ state: d.info.playerState }); }
      const ps = d?.info?.progressState;
      if (ps && typeof ps.seekableStart === 'number' && typeof ps.seekableEnd === 'number' && ps.seekableEnd > ps.seekableStart) {
        const first = win.current == null;
        win.current = { start: ps.seekableStart, end: ps.seekableEnd };
        if (first && !playingRef.current) { cmd('pauseVideo'); if (!outside(tRef.current)) cmd('seekTo', [tRef.current, true]); }
        if (!goneSaid.current && endRef.current != null) {
          goneSaid.current = true;
          const all = endRef.current < ps.seekableStart - 1;
          knownRef.current?.(all);
          if (all) goneRef.current?.();
        }
      }
      if (typeof d?.info?.currentTime === 'number') { ytT.current = d.info.currentTime; leadRef.current?.onInfo({ t: d.info.currentTime }); if (!adRef.current && ytState.current === 1) timeCb.current?.(d.info.currentTime); }
      if (d?.info?.muted === false && !leadRef.current) cmd('mute');
      if (typeof d?.info?.muted === 'boolean') leadRef.current?.onInfo({ muted: d.info.muted });
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  useEffect(() => {
    if (lead) return;
    const now = outside(t);
    if (now !== gone) { setGone(now); if (now) cmd('pauseVideo'); else if (ready) { cmd('seekTo', [t, true]); if (playing) cmd('playVideo'); } }
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || gone || lead) return;
    if (!playing && win.current == null && !probed.current) { probed.current = true; cmd('seekTo', [tRef.current, true]); cmd('playVideo'); return; }
    const y = at();
    if (playing && (y == null || Math.abs(y - tRef.current) > 1.5)) seek();
    if (playing) cmd('playVideo'); else cmd('pauseVideo');
  }, [playing, ready, gone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || seekN === 0 || gone || lead) return;
    const y = at();
    if (y == null || Math.abs(y - tRef.current) > 0.5) seek();
    if (!playing) cmd('pauseVideo');
  }, [seekN, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    let last: number | null = null;
    let still = 0;
    const h = setInterval(() => {
      const y = ytT.current;
      still = ytState.current === 1 && y != null && last != null && Math.abs(y - last) < 0.05 ? still + 1 : 0;
      last = y;
      const now = still >= 3;
      if (now !== adByStall.current) { adByStall.current = now; adCheck(); }
    }, 1000);
    return () => clearInterval(h);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`txyt${ad ? ' txyt--ad' : ''}`}>
      <iframe ref={ref} onLoad={onLoad} referrerPolicy="strict-origin-when-cross-origin" src={`https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`} title={title} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" />
      {!ad && <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
      <div className={`txyt__paused${(ytPaused || busy || !ready) && !ad && !gone ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay">{busy || !ready ? <span className="gfull__spin txyt__spin" /> : <PlayGlyph size={44} />}</span></div>
      {ad && <div className="txyt__ad" aria-live="polite">Ad on YouTube · the transcript carries on after it</div>}
      {gone && <div className="txyt__gone"><span>YouTube no longer has this part of the broadcast</span><small>A live stream can be rewound only 12 hours</small></div>}
    </div>
  );
}
export const PAUSE_D = <><rect x="6.5" y="5" width="3.75" height="14" rx="1.2" /><rect x="13.75" y="5" width="3.75" height="14" rx="1.2" /></>;
export const PLAY_D = <path d="M7.5 5.6a1 1 0 0 1 1.52-.85l9.1 5.55a1 1 0 0 1 0 1.7l-9.1 5.55a1 1 0 0 1-1.52-.85V5.6Z" />;

export function MuteButton({ player, size }: { player: Pick<TxPlayer, 'muted' | 'toggleMute'>; size: number }) {
  const label = player.muted ? 'Unmute' : 'Mute';
  return (
    <button type="button" className={`mutebtn${size < 36 ? ' mutebtn--sm' : size > 36 ? ' mutebtn--lg' : ''}`} aria-label={label} title={label} aria-pressed={player.muted} onClick={player.toggleMute}>
      <Icon d={player.muted ? D.volumeOff : D.volume} size={17} sw={1.6} style={{ color: player.muted ? 'var(--ink-38)' : 'var(--ink-70)' }} />
    </button>
  );
}
export function useFlash(): [string, (m: string) => void] {
  const [msg, setMsg] = useState('');
  const t = useRef<any>(null);
  const flash = useCallback((m: string) => { clearTimeout(t.current); setMsg(m); t.current = setTimeout(() => setMsg(''), 3000); }, []);
  useEffect(() => () => clearTimeout(t.current), []);
  return [msg, flash];
}

export interface TxPlayer {
  ended?: boolean;
  playing: boolean;
  t: number;
  idx: number;
  dur: number;
  muted: boolean;
  wordSync: boolean;
  timed?: boolean;
  videoAt?: (t: number) => void;
  engaged: boolean;
  clipPos?: ReadPos | null;
  has: boolean;
  preparing?: boolean;
  starting?: number | null;
  autoplay?: () => Promise<boolean | null>;
  edgeWait?: boolean;
  silent?: boolean;
  joinAt?: (t: number) => void;
  error: ErrorLike | null;
  seekN: number;
  toggleMute: () => void;
  stop: () => void;
  toggle: () => void;
  pause: () => void;
  seekRow: (i: number) => void;
  seekFrac?: (f: number) => void;
  resumeAt?: (p: PlayPos) => void;
  seekWord?: (w: Word) => void;
  playRow: (i: number) => void;
  prev: () => void;
  next: () => void;
  hold: () => void;
  release: () => void;
  clearError: () => void;
  setVolume: (v: number) => void;
  silence?: (on: boolean) => void;
}

const DUCK = 0.2;
const DUCK_MS = 140;
const UNDUCK_MS = 320;

export function useDuck(players: TxPlayer[], ducked: boolean) {
  const live = useRef(players);
  live.current = players;
  const raf = useRef(0);
  const at = useRef(1);
  const fade = useCallback((to: number, ms: number) => {
    cancelAnimationFrame(raf.current);
    const from = at.current;
    const t0 = performance.now();
    const step = () => {
      const k = ms > 0 ? Math.min(1, (performance.now() - t0) / ms) : 1;
      at.current = from + (to - from) * k;
      for (const p of live.current) p.setVolume(at.current);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    step();
  }, []);
  useEffect(() => { fade(ducked ? DUCK : 1, ducked ? DUCK_MS : UNDUCK_MS); }, [ducked, fade]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); at.current = 1; for (const p of live.current) p.setVolume(1); }, []);
}
export function useYtLead(rows: Row[], lenS: number | null, offsetS: number, edgeS: number | null): { player: TxPlayer; lead: YtLead; setVideoSound: (on: boolean) => void } {
  const cmdRef = useRef<((func: string, args?: unknown[]) => void) | null>(null);
  const readyRef = useRef(false);
  const pending = useRef(false);
  const [state, setState] = useState<number | null>(null);
  const [muted, setMuted] = useState(true);
  const mutedRef = useRef(true);
  const soundOff = useRef(false);
  const [t, setT] = useState(0);
  const tRef = useRef(0); tRef.current = t;
  const base = useRef<{ t: number; at: number }>({ t: 0, at: 0 });
  const offset = useRef(offsetS); offset.current = offsetS;
  const edgeRef = useRef(edgeS); edgeRef.current = edgeS;
  const [edgeWait, setEdgeWait] = useState(false);
  const edgeWaitRef = useRef(false);
  const setWait = (w: boolean) => { edgeWaitRef.current = w; setEdgeWait(w); };
  const send = (func: string, args?: unknown[]) => cmdRef.current?.(func, args);
  const playing = state === 1 || state === 3;
  const stateRef = useRef<number | null>(null);
  const ytMuted = useRef<boolean | null>(null);
  const lead = useMemo<YtLead>(() => ({
    muted: true,
    bind: (c) => { cmdRef.current = c; if (!c) readyRef.current = false; },
    onInfo: (i) => {
      if (i.ready && !readyRef.current) { readyRef.current = true; if (pending.current) { pending.current = false; send(lead.muted ? 'mute' : 'unMute'); send('playVideo'); } }
      if (typeof i.state === 'number') { stateRef.current = i.state; setState(i.state); if (i.state === 1 && !wantPlay.current && !held.current && performance.now() - pausedAt.current < 6000) send('pauseVideo'); }
      if (typeof i.muted === 'boolean') ytMuted.current = i.muted;
      if (typeof i.t === 'number') {
        const at = i.t - offset.current;
        base.current = { t: at, at: performance.now() };
        if (!(at < tRef.current && tRef.current - at < 0.35)) setT(Math.max(0, at));
      }
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  lead.muted = mutedRef.current || soundOff.current;
  useEffect(() => {
    if (state !== 1) return;
    let raf = 0;
    const tick = () => {
      const b = base.current;
      const at = b.t + Math.min(1.2, (performance.now() - b.at) / 1000);
      if (edgeRef.current != null && at >= edgeRef.current) { setWait(true); send('pauseVideo'); setT(at); return; }
      if (at > tRef.current) setT(at);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!edgeWait || edgeS == null || edgeS < t + 1.5) return;
    setWait(false);
    send('playVideo');
  }, [edgeWait, edgeS, t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (edgeS == null && edgeWaitRef.current) { setWait(false); send('playVideo'); } }, [edgeS]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastEnd = rows.length ? rows[rows.length - 1].words[rows[rows.length - 1].words.length - 1]?.end ?? rows[rows.length - 1].start + 4 : 0;
  const dur = lenS || lastEnd || 1;
  const idx = useMemo(() => {
    if (!rows.length) return 0;
    let i = 0;
    for (let k = 0; k < rows.length; k++) if (rows[k].start <= t + 0.05) i = k;
    return i;
  }, [rows, t]);
  const [seekN, setSeekN] = useState(0);
  const seek = (s0: number) => {
    const s = Math.max(0, edgeRef.current != null ? Math.min(s0, Math.max(0, edgeRef.current - 0.5)) : s0);
    send('seekTo', [s + offset.current, true]);
    base.current = { t: s, at: performance.now() };
    setT(s); setSeekN((n) => n + 1);
  };
  const wantPlay = useRef(false);
  const [want, setWantState] = useState(false);
  const pausedAt = useRef(-1e9);
  const setWant = (v: boolean) => { wantPlay.current = v; setWantState(v); };
  const playRetry = useRef<number | undefined>(undefined);
  const nudgePlay = (n: number) => {
    window.clearTimeout(playRetry.current);
    playRetry.current = window.setTimeout(() => {
      if (!wantPlay.current || n <= 0 || stateRef.current === 1 || stateRef.current === 3) return;
      send('playVideo');
      nudgePlay(n - 1);
    }, 1200);
  };
  useEffect(() => () => window.clearTimeout(playRetry.current), []);
  const play = () => { setWant(true); if (!chosen.current && mutedRef.current) soundUp(); if (!readyRef.current) { pending.current = true; return; } send('playVideo'); nudgePlay(3); };
  const pause = () => { setWant(false); pausedAt.current = performance.now(); window.clearTimeout(playRetry.current); pending.current = false; setWait(false); send('pauseVideo'); };
  const toggle = () => {
    if (wantPlay.current || playing) { pause(); return; }
    if (!readyRef.current) { if (!chosen.current && mutedRef.current) soundUp(); setWant(true); pending.current = true; return; }
    if (edgeWaitRef.current) { setWait(false); return; }
    if (t >= dur - 0.25) seek(0);
    play();
  };
  const seekRow = (i: number) => { const r = rows[Math.max(0, Math.min(rows.length - 1, i))]; if (r) seek(r.start); };
  const held = useRef(false);
  const applyMute = () => { const v = mutedRef.current || soundOff.current; lead.muted = v; send(v ? 'mute' : 'unMute'); };
  const setMute = (m: boolean) => { mutedRef.current = m; setMuted(m); applyMute(); };
  const chosen = useRef(false);
  const soundUp = () => { setMute(false); if (soundOff.current) return; setTimeout(() => { if (stateRef.current === 2 && wantPlay.current && !mutedRef.current) { setMute(true); send('playVideo'); } }, 900); };
  const setVideoSound = (on: boolean) => { if (soundOff.current === !on) return; soundOff.current = !on; applyMute(); };
  const autoplay = async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const until = async (ok: () => boolean, ms: number) => { for (let i = 0; i < ms / 250 && !ok(); i++) await wait(250); return ok(); };
    if (!await until(() => readyRef.current, 10000)) return null;
    setWant(true);
    setMute(true);
    for (let i = 0; i < 5 && stateRef.current !== 1; i++) { send('playVideo'); await until(() => stateRef.current === 1, 1500); }
    if (stateRef.current !== 1) return null;
    if (soundOff.current) { setMute(true); return false; }
    setMute(false);
    await wait(1200);
    if (stateRef.current === 1 && ytMuted.current === false) return true;
    setMute(true); send('playVideo');
    return false;
  };
  const player: TxPlayer = {
    autoplay,
    playing, ended: state === 0, t, idx, dur, muted, seekN, toggle, seekRow,
    toggleMute: () => { chosen.current = true; const m = !mutedRef.current; setMute(m); if (!m && !soundOff.current && stateRef.current === 1) setTimeout(() => { if (stateRef.current === 2 && !mutedRef.current) { setMute(true); send('playVideo'); } }, 900); },
    seekFrac: (f: number) => seek(Math.max(0, Math.min(1, f)) * dur),
    seekWord: (w: Word) => seek(w.start),
    playRow: (i: number) => { seekRow(i); if (!playing) play(); },
    stop: () => { pause(); seek(0); },
    engaged: playing || t > 0,
    prev: () => seekRow(idx - 1), next: () => seekRow(idx + 1),
    hold: () => { if (playing) { send('pauseVideo'); held.current = true; } },
    release: () => { if (held.current) { held.current = false; play(); } },
    error: null, clearError: () => {}, has: true, edgeWait, wordSync: true, preparing: want && state !== 1 && !edgeWait,
    pause,
    setVolume: (v: number) => send('setVolume', [Math.round(v * 100)]),
  };
  return { player, lead, setVideoSound };
}

export function useTxPlayer(url: string | null, available: boolean, rows: Row[], lenS: number | null, offsetS = 0, edgeS: number | null = null): TxPlayer {
  const audio = useRef<HTMLMediaElement | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const silenced = useRef(false);
  const [error, setError] = useState<ErrorLike | null>(null);
  const [ready, setReady] = useState(false);
  const offset = useRef(offsetS); offset.current = offsetS;
  const carry = useRef<{ t: number; playing: boolean; asked?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setReady(false);
    const from = carry.current;
    carry.current = null;
    if (!from) setT(0);
    if (!url) { setPlaying(false); audio.current = null; return; }
    const a = newMediaElement(url);
    const off = offset.current;
    a.preload = 'metadata';
    a.muted = mutedRef.current || silenced.current;
    a.onplay = () => setPlaying(true);
    a.onpause = () => { setPlaying(false); setBuffering(false); };
    a.onended = () => { setPlaying(false); setBuffering(false); };
    a.onwaiting = () => setBuffering(true);
    a.onstalled = () => { if (!a.paused && a.readyState < 3) setBuffering(true); };
    a.onplaying = () => setBuffering(false);
    a.oncanplay = () => setBuffering(false);
    a.onloadedmetadata = () => {
      setReady(true);
      a.currentTime = (from?.t ?? 0) + off;
      if (from?.playing) void a.play().catch((e) => { if (!(from.asked && e?.name === 'NotAllowedError')) setError(describe(e)); });
    };
    a.onerror = () => {
      setPlaying(false);
      const err = a.error;
      const fallback = mediaErrorText(err, false);
      void explainAudioError(url).then((why) => {
        if (!isNotCaptured(why?.message)) reportMediaError(err);
        if (audio.current !== a) return;
        setError({ message: why?.message ?? fallback });
        if (!why?.permanent) audio.current = null;
      });
    };
    audio.current = a;
    return () => {
      carry.current = { t: Math.max(0, a.currentTime - off), playing: !a.paused && !a.ended };
      a.pause(); a.onplay = a.onpause = a.onended = a.onloadedmetadata = a.onerror = a.onwaiting = a.onstalled = a.onplaying = a.oncanplay = null; audio.current = null; setBuffering(false);
    };
  }, [url, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { carry.current = null; }, []);
  const lastEnd = rows.length ? rows[rows.length - 1].words[rows[rows.length - 1].words.length - 1]?.end ?? rows[rows.length - 1].start + 4 : 0;
  const windowed = offsetS > 0 || (lenS != null && ready && audio.current != null && Number.isFinite(audio.current.duration) && audio.current.duration > lenS + 1);
  const dur = (!windowed && ready && audio.current && Number.isFinite(audio.current.duration) && audio.current.duration) || lenS || lastEnd || 1;
  const durRef = useRef(dur); durRef.current = dur;
  const windowedRef = useRef(windowed); windowedRef.current = windowed;
  const edgeRef = useRef(edgeS); edgeRef.current = edgeS;
  const [edgeWait, setEdgeWait] = useState(false);
  const edgeWaitRef = useRef(false);
  const setWait = (w: boolean) => { edgeWaitRef.current = w; setEdgeWait(w); };
  useEffect(() => { if (edgeS == null && edgeWaitRef.current) { setWait(false); void audio.current?.play().catch(() => {}); } }, [edgeS]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!edgeWait || edgeS == null || edgeS < t + 1.5) return;
    setWait(false);
    void audio.current?.play().catch(() => {});
  }, [edgeWait, edgeS, t]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audio.current;
      if (a) {
        const at = a.currentTime - offset.current;
        if (windowedRef.current && at >= durRef.current) { a.pause(); setT(durRef.current); return; }
        if (edgeRef.current != null && at >= edgeRef.current) { setWait(true); a.pause(); setT(at); return; }
        setT(at);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const idx = useMemo(() => {
    if (!rows.length) return 0;
    let i = 0;
    for (let k = 0; k < rows.length; k++) if (rows[k].start <= t + 0.05) i = k;
    return i;
  }, [rows, t]);
  const [seekN, setSeekN] = useState(0);
  const seek = (s0: number) => { const s = edgeRef.current != null ? Math.min(s0, Math.max(0, edgeRef.current - 0.5)) : s0; const a = audio.current; setT(s); if (a) a.currentTime = s + offset.current; setSeekN((n) => n + 1); };
  const playFailed = (e: unknown) => { if ((e as { name?: string } | null)?.name !== 'AbortError') setError(describe(e)); };
  const toggle = () => {
    const a = audio.current;
    if (!a) {
      if (!url && available) { carry.current = carry.current?.asked ? null : { t, playing: true, asked: true }; return; }
      if (url) setAttempt((n) => n + 1);
      setError({ message: available ? 'The audio player is not ready yet — try again in a moment.' : 'There is no audio for this transcription.' });
      return;
    }
    if (playing) { a.pause(); return; }
    if (edgeWaitRef.current) { setWait(false); return; }
    if (a.currentTime < offset.current) a.currentTime = offset.current;
    if (t >= dur - 0.25) seek(0);
    void a.play().catch(playFailed);
  };
  const seekRow = (i: number) => { const r = rows[Math.max(0, Math.min(rows.length - 1, i))]; if (r) seek(r.start); };
  const seekFrac = (f: number) => seek(Math.max(0, Math.min(1, f)) * dur);
  const resumeAt = (p: PlayPos) => {
    const at = placePosition(p, rows, dur);
    seek(at.t);
    const a = audio.current;
    if (!a) return;
    if (!at.playing) { a.pause(); return; }
    setWait(false);
    void a.play().catch(playFailed);
  };
  const seekWord = (w: Word) => seek(w.start);
  const playRow = (i: number) => {
    seekRow(i);
    const a = audio.current;
    if (a && a.paused) void a.play().catch(playFailed);
  };
  const held = useRef(false);
  const lastNudge = useRef(0);
  const hold = () => { if (playing) { audio.current?.pause(); held.current = true; } };
  const release = () => { if (held.current) { held.current = false; void audio.current?.play().catch(playFailed); } };
  const toggleMute = () => { const m = !mutedRef.current; mutedRef.current = m; if (audio.current) audio.current.muted = m || silenced.current; setMuted(m); };
  const autoplay = async (): Promise<boolean | null> => {
    const a = audio.current;
    if (!a) return null;
    if (a.currentTime < offset.current) a.currentTime = offset.current;
    const mute = (m: boolean) => { mutedRef.current = m; a.muted = m || silenced.current; setMuted(m); };
    try { mute(false); await a.play(); return true; } catch (e) {
      if ((e as { name?: string } | null)?.name !== 'NotAllowedError') { mute(true); return null; }
    }
    try { mute(true); await a.play(); return false; } catch { return null; }
  };
  return {
    autoplay,
    playing, t, idx, dur, muted, toggleMute, toggle, seekRow, seekFrac, resumeAt, seekWord, playRow, seekN,
    stop: () => { const a = audio.current; if (a) { a.pause(); a.currentTime = offset.current; } setT(0); },
    videoAt: (vt: number) => {
      const a = audio.current;
      if (!a || a.paused || a.ended || held.current || Date.now() - lastNudge.current < 3000) return;
      const want = vt + offset.current;
      if (Math.abs(a.currentTime - want) <= 0.2) return;
      lastNudge.current = Date.now();
      a.currentTime = want;
    },
    engaged: playing || t > 0,
    prev: () => seekRow(idx - 1), next: () => seekRow(idx + 1), hold, release,
    error, clearError: () => setError(null), has: available, edgeWait, preparing: buffering,
    wordSync: true,
    pause: () => { setWait(false); if (carry.current?.asked) carry.current = null; audio.current?.pause(); },
    setVolume: (v: number) => { if (audio.current) audio.current.volume = v; },
    silence: (on: boolean) => { silenced.current = on; if (audio.current) audio.current.muted = mutedRef.current || on; },
  };
}

function useTxVoicePlayer(clips: VoiceClip[], rows: Row[], lenS: number | null, key: string, muted?: Set<number>, wordTimes?: Record<string, [number, number][]>, timed = false, coming?: ReadonlySet<number>): TxPlayer {
  const comingRef = useRef<ReadonlySet<number>>(new Set());
  comingRef.current = coming ?? comingRef.current;
  const q = useRef<ClipQueue | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [seekN, setSeekN] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const quietRef = useRef(quiet); quietRef.current = quiet;
  const [error, setError] = useState<ErrorLike | null>(null);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [starting, setStarting] = useState<number | null>(null);
  const [aim, setAim] = useState<{ t: number; sid: number | null } | null>(null);
  const aimRef = useRef(aim); aimRef.current = aim;
  const [clipPos, setClipPos] = useState<ReadPos | null>(null);
  const [restS, setRestS] = useState<number | null>(null);
  const [restBase, setRestBase] = useState<number | null>(null);
  const [silent, setSilent] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const timedRef = useRef(timed);
  const lineIdsRef = useRef<number[]>([]);
  timedRef.current = timed;
  if (q.current) q.current.flow = timed;
  const videoRef = useRef<{ t: number; at: number } | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const timesRef = useRef(wordTimes);
  timesRef.current = wordTimes;
  const wire = useCallback((queue: ClipQueue) => {
    queue.finite = true;
    queue.coming = (id) => comingRef.current.has(id);
    queue.readAhead = 6;
    queue.readAheadS = 45;
    queue.onWaiting = (id) => setWaiting(id);
    queue.onStarting = (since) => setStarting(since);
    queue.onSentence = (id) => {
      setPlaying(queue.playing);
      if (id == null) return;
      const i = rowsRef.current.findIndex((r) => r.sentenceId === id);
      if (i >= 0) setPos(i);
    };
    queue.onError = (e) => { setPlaying(queue.playing); setError(e instanceof VoiceNotStarted ? { message: 'The voice could not be started. Press Play to try again.', code: 'voice_not_started' } : { message: 'A line of this reading could not be played.' }); };
    queue.gapBefore = (prev, next) => {
      if (!timedRef.current) return 0;
      const rs = rowsRef.current;
      const a = rs.find((r) => r.sentenceId === prev);
      const b = rs.find((r) => r.sentenceId === next);
      if (!b) return 0;
      const aimed = aimRef.current;
      if (prev == null) return aimed && aimed.sid === next ? Math.max(0, b.start - aimed.t) : 0;
      const v = videoRef.current;
      if (v && Date.now() - v.at < 2000) return Math.max(0, b.start - (v.t + (Date.now() - v.at) / 1000 * queue.rate));
      if (!a || b.start <= a.start) return 0;
      return Math.max(0, b.start - lineEnd(a, a.start, a.start + 4));
    };
    queue.flow = timedRef.current;
    queue.silentSpan = (id) => {
      const rs = rowsRef.current;
      const i = rs.findIndex((r) => r.sentenceId === id);
      const r = rs[i];
      if (!r) return null;
      const end = rs[i + 1]?.start ?? lineEnd(r, r.start, r.start + 4);
      const span = Math.max(0, end - r.start);
      const v = videoRef.current;
      const now = v && Date.now() - v.at < 2000 ? v.t + (Date.now() - v.at) / 1000 * (queue.rate || 1) : r.start;
      const fromS = Math.max(0, Math.min(span, now - r.start));
      return { fromS, ms: ((span - fromS) * 1000) / (queue.rate || 1) };
    };
    queue.speakable = (id) => {
      const m = mutedRef.current;
      if (!m || !m.size) return true;
      const r = rowsRef.current.find((x) => x.sentenceId === id);
      return !r || !m.has(r.speaker);
    };
  }, []);
  const keyRef = useRef<string | null>(null);
  const snapRef = useRef<PlayPos | null>(null);
  const pendingRef = useRef<PlayPos | null>(null);
  const [resuming, setResuming] = useState(false);
  const applyRef = useRef<(p: PlayPos) => void>(() => {});
  const park = (p: PlayPos | null) => {
    pendingRef.current = p;
    setResuming(!!p?.playing);
    if (!p) return;
    const i = placePosition(p, rowsRef.current, dur).index;
    setPos(i);
    posRef.current = i;
  };
  const drop = () => { if (pendingRef.current) park(null); };
  useEffect(() => {
    if (keyRef.current !== key) {
      const was = keyRef.current != null ? snapRef.current : null;
      keyRef.current = key;
      q.current?.stop();
      q.current = new ClipQueue();
      wire(q.current);
      q.current.setSequence(lineIdsRef.current);
      setPlaying(false);
      setPos(0);
      setError(null);
      setStarting(null);
      setAim(null);
      park(was && (was.playing || was.t > 0) ? was : null);
    }
    const queue = q.current!;
    queue.setMuted(quietRef.current);
    for (const c of clips) queue.add(c);
    const p = pendingRef.current;
    if (p && (timedRef.current || clips.some((c) => c.sentenceId >= (p.sentenceId ?? 0)))) { park(null); applyRef.current(p); }
  }, [key, clips]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineIds = useMemo(() => (timed ? rows.map((r) => r.sentenceId).filter((id): id is number => id != null) : []), [rows, timed]);
  lineIdsRef.current = lineIds;
  useEffect(() => { q.current?.setSequence(lineIds); }, [lineIds, key]);
  useEffect(() => () => { q.current?.stop(); q.current = null; keyRef.current = null; }, []);
  const hasPos = clipPos != null || restS != null;
  useEffect(() => {
    if (!playing && !hasPos) { setClipPos(null); setRestS(null); return; }
    const tick = () => {
      const rest = q.current?.resting() ?? null;
      setSilent(!!rest?.silent);
      if (rest?.silent && aimRef.current) { aimRef.current = null; setAim(null); }
      setRestS((prev) => (rest == null ? null : prev != null && Math.abs(prev - rest.s) < 0.05 ? prev : rest.s));
      const a = aimRef.current;
      if (rest == null) setRestBase(null);
      else if (a && a.sid === rest.sentenceId) { setRestBase(a.t); aimRef.current = null; setAim(null); }
      const at = q.current?.position() ?? null;
      const w = at && timesRef.current ? timesRef.current[String(at.sentenceId)] ?? null : null;
      if (a && at && at.sentenceId === a.sid && at.t > 0.1) setAim(null);
      setClipPos((prev) => {
        if (!at) return prev == null ? prev : null;
        if (prev && Math.abs(prev.t - at.t) < 0.05 && prev.dur === at.dur && prev.words === w) return prev;
        return { t: at.t, dur: at.dur, words: w };
      });
    };
    tick();
    const h = setInterval(tick, 100);
    return () => clearInterval(h);
  }, [playing, hasPos]);
  const voiced = useMemo(() => new Set(clips.map((c) => c.sentenceId)), [clips]);
  const heard = (i: number) => { const sid = rows[i]?.sentenceId; return sid != null && voiced.has(sid); };
  const step = (from: number, dir: 1 | -1): number | null => {
    for (let i = from; i >= 0 && i < rows.length; i += dir) if (heard(i)) return i;
    return null;
  };
  const idx = Math.max(0, Math.min(pos, Math.max(0, rows.length - 1)));
  const lastEnd = rows.length ? rows[rows.length - 1].start + 4 : 0;
  const dur = lenS || lastEnd || 1;
  const held = useRef(false);
  const posRef = useRef(pos); posRef.current = pos;
  const start = (i: number) => { q.current?.play(rows[i]?.sentenceId ?? null); setPlaying(!!q.current?.playing); };
  const goRow = (i: number) => {
    const at = Math.max(0, Math.min(Math.max(0, rows.length - 1), i));
    setPos(at);
    posRef.current = at;
    setSeekN((n) => n + 1);
    q.current?.seek(rows[at]?.sentenceId ?? null);
    setPlaying(!!q.current?.playing);
  };
  const seekRow = (i: number) => { drop(); setAim(null); q.current?.startWithin(-1, 0); goRow(i); };
  const spanOf = (i: number) => {
    const r = rows[i];
    const from = r?.start ?? 0;
    const next = rows[i + 1]?.start ?? lineEnd(r, from, dur);
    return { from, span: Math.max(0, next - from) };
  };
  const cur = spanOf(idx);
  const speech = Math.max(0, Math.min(cur.span, lineEnd(rows[idx], cur.from, cur.from + 4) - cur.from));
  const tNow = aim ? aim.t
    : !timed ? (clipPos && clipPos.dur > 0 ? cur.from + Math.min(cur.span, (clipPos.t / clipPos.dur) * cur.span) : cur.from)
    : restS != null && silent ? cur.from + Math.min(cur.span, restS)
    : restS != null ? (restBase != null ? Math.min(cur.from, restBase + restS) : cur.from + Math.min(cur.span, speech + restS))
    : clipPos && clipPos.dur > 0 ? cur.from + Math.min(speech, (clipPos.t / clipPos.dur) * speech)
    : cur.from;
  useEffect(() => { snapRef.current = pendingRef.current ?? snapPosition(rows, tNow, playing, dur); });
  const api: TxPlayer = {
    playing: playing || resuming,
    t: tNow,
    idx, dur, muted: quiet, wordSync: false, timed, clipPos: aim ? null : clipPos,
    videoAt: (t: number) => { videoRef.current = { t, at: Date.now() }; },
    engaged: playing || clipPos != null,
    has: clips.length > 0,
    preparing: waiting != null || resuming,
    silent: playing && silent,
    starting,
    error, seekN,
    toggleMute: () => { const m = !quietRef.current; quietRef.current = m; q.current?.setMuted(m); setQuiet(m); },
    toggle: () => {
      if (resuming) { drop(); return; }
      drop();
      if (playing) { q.current?.pause(); setPlaying(false); return; }
      setError(null);
      const at = posRef.current;
      if (!aimRef.current && q.current?.resume(rows[at]?.sentenceId ?? null)) { setPlaying(true); return; }
      start(at);
    },
    pause: () => { drop(); q.current?.pause(); setPlaying(false); },
    stop: () => { drop(); q.current?.pause(); setPlaying(false); setPos(0); setClipPos(null); q.current?.seek(rows[0]?.sentenceId ?? null); },
    seekRow,
    resumeAt: (p: PlayPos) => { park(p); if (clips.some((c) => c.sentenceId >= (p.sentenceId ?? 0))) { park(null); applyRef.current(p); } },
    seekFrac: (f: number) => {
      drop();
      const t = Math.max(0, Math.min(1, f)) * dur;
      let i = 0;
      for (let k = 0; k < rows.length; k++) if (rows[k].start <= t) i = k;
      const r = rows[i];
      const before = timed && r && t < r.start - 0.05;
      if (timed && r && (before || (rows[i + 1] && t >= lineEnd(r, r.start, r.start + 4)))) {
        const k = before ? i : i + 1;
        const n = rows[k];
        q.current?.startWithin(-1, 0);
        const a = { t, sid: n.sentenceId ?? null };
        aimRef.current = a;
        setAim(a);
        goRow(k);
        return;
      }
      const sid = r?.sentenceId ?? null;
      const { from, span } = spanOf(i);
      let share = span > 0 ? Math.max(0, Math.min(1, (t - from) / span)) : 0;
      const wt = sid != null ? timesRef.current?.[String(sid)] : undefined;
      const clipEnd = wt?.length ? wt[wt.length - 1][1] : 0;
      if (r && wt && wt.length === r.words.length && clipEnd > 0) {
        let j = 0;
        for (let k = 0; k < r.words.length; k++) if (r.words[k].start <= t) j = k;
        const w = r.words[j];
        const into = w.end > w.start ? Math.max(0, Math.min(1, (t - w.start) / (w.end - w.start))) : 0;
        share = Math.min(1, (wt[j][0] + into * (wt[j][1] - wt[j][0])) / clipEnd);
      }
      if (sid != null) q.current?.startWithin(sid, share);
      setAim(share > 0.01 ? { t, sid } : null);
      goRow(i);
    },
    seekWord: wordTimes ? (w: Word) => {
      const r = rows[idx];
      if (!r || r.sentenceId == null) return;
      const j = r.words.findIndex((x) => x.seq === w.seq && x.idx === w.idx);
      const t = j >= 0 ? timesRef.current?.[String(r.sentenceId)]?.[j]?.[0] : undefined;
      if (t != null) q.current?.seekWithin(t);
    } : undefined,
    playRow: (i: number) => {
      drop();
      const at = Math.max(0, Math.min(Math.max(0, rows.length - 1), i));
      setAim(null);
      q.current?.startWithin(-1, 0);
      setPos(at);
      posRef.current = at;
      setSeekN((n) => n + 1);
      start(at);
    },
    prev: () => { const i = step(idx - 1, -1); if (i != null) seekRow(i); },
    next: () => { const i = step(idx + 1, 1); if (i != null) seekRow(i); },
    hold: () => { if (playing) { q.current?.pause(); held.current = true; } },
    release: () => { if (held.current) { held.current = false; start(posRef.current); } },
    clearError: () => setError(null),
    setVolume: (v: number) => q.current?.setVolume(v),
  };
  function joinRow(i: number) {
    const sid = rows[i]?.sentenceId;
    if (sid == null) return;
    setPos(i);
    posRef.current = i;
    setAim(null);
    aimRef.current = null;
    q.current?.joinSilently(sid);
    const rest = q.current?.resting() ?? null;
    setRestS(rest?.s ?? null);
    setSilent(!!rest?.silent);
    setPlaying(!!q.current?.playing);
  }
  api.joinAt = timed ? (t: number) => { drop(); joinRow(placePosition({ t, playing: true, sentenceId: null, offset: 0, ended: false }, rows, dur).index); } : undefined;
  applyRef.current = (p: PlayPos) => {
    const at = placePosition(p, rows, dur);
    if (timedRef.current) {
      setPos(at.index);
      posRef.current = at.index;
      if (at.playing) joinRow(at.index);
      return;
    }
    api.seekFrac?.(at.t / dur);
    if (at.playing) start(posRef.current);
  };
  return api;
}

export const NO_SEEK = () => {};
const TX_PICKER_NOTE = 'The transcript and its voice switch to this language.';

const TX_SIDE = { title: 'TRANSCRIPT LANGUAGE', note: 'The transcript and its voice switch to this language.' };
export const PUB_SIDE = { title: 'LANGUAGE', note: 'The transcript and its voice switch to this language.' };


export interface VoiceSheetCtx {
  people: CastMember[];
  gvList: AvailableVoice[];
  autoOf: (key: number) => AvailableVoice | null;
  savedFor: (sp: CastMember) => AvailableVoice | null;
}

export interface NoCloneNote { busy?: boolean; title: string; sub: string; tip?: string; action?: () => void }

export interface VoiceSheetHooks {
  cloneOn?: boolean;
  pendingClones?: boolean;
  titleNode?: React.ReactNode;
  badge?: (ctx: VoiceSheetCtx) => number;
  onAddVoice?: (v: AvailableVoice) => void;
  onPickVoice?: (v: AvailableVoice) => boolean | void;
  onSelectSpeaker?: (key: number) => void;
  noCloneFor?: (sp: CastMember, auto: AvailableVoice | null, ctx: VoiceSheetCtx) => NoCloneNote | null;
  castNoClone?: (sp: CastMember, ctx: VoiceSheetCtx) => boolean;
  castShort?: (sp: CastMember, ctx: VoiceSheetCtx) => boolean;
  castBuilding?: (sp: CastMember, ctx: VoiceSheetCtx) => boolean;
  castWarn?: (sp: CastMember, ctx: VoiceSheetCtx) => string | null;
}

export function useTxVoice({ recordingId, model, rows, lenS, ended, cred, langs, srcLang, canTranslate, pickedLang, setPickedLang, side, hearOriginal = false, timed = false, stockVoices = false, stickyPicker = false, pickerBusy = null, voiceSheet , forcedVoice = null, consent = true }: {
  consent?: boolean;
  voiceSheet?: VoiceSheetHooks;
  forcedVoice?: string | null;
  hearOriginal?: boolean;
  stockVoices?: boolean;
  stickyPicker?: boolean;
  pickerBusy?: string | null;
  timed?: boolean;
  recordingId: string | null;
  model: Model;
  rows: Row[];
  lenS: number | null;
  ended: boolean;
  cred: MediaCred;
  langs: LanguageLists | null;
  srcLang: string | null;
  canTranslate: boolean;
  pickedLang: string | null | undefined;
  setPickedLang: (l: string | null | undefined) => void;
  side?: { title: string; note: string };
}) {
  const { onAddVoice, onPickVoice, onSelectSpeaker, noCloneFor, castNoClone, castShort, castBuilding, castWarn, badge, titleNode: voiceTitleNode } = voiceSheet ?? {};
  const hooked = !!voiceSheet;
  const pendingClones = !!voiceSheet?.pendingClones;
  const [recent, pushRecent] = useRecentLangs();
  const [picked, setPicked] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [fromVoices, setFromVoices] = useState(false);
  const [want, setWant] = useState(false);
  const lang = pickedLang ?? srcLang;
  const original = pickedLang === null;
  const on = pickedLang != null || picked != null;
  const speakable = (c: string | null | undefined) => !!c && !!langs?.voice.includes(c);
  const vLang = speakable(original ? srcLang : lang) ? (original ? srcLang : lang) : 'en';
  const preview = useVoicePreview(vLang);
  const cloneOn = voiceSheet?.cloneOn ?? true;
  const [catVer, setCatVer] = useState(0);
  const cloneSeen = useRef(cloneOn);
  useEffect(() => { if (cloneSeen.current !== cloneOn) { cloneSeen.current = cloneOn; setCatVer((n) => n + 1); } }, [cloneOn]);
  const catalogue = useVoiceCatalogue(vLang, on || ended || sheet, namedCount(model) * 1000 + catVer, { id: recordingId ?? null, shareCode: cred.shareCode ?? null });
  const gvList = useMemo(() => (catalogue?.voices ?? []).filter((v) => hooked || !v.cloned || v.speaker != null), [catalogue, hooked]);
  const gVoicePick = gvList.length > 1;
  const meta = langMeta(langs, lang);
  const t = strings();
  const trLangs = useMemo(() => pickerLanguages(langs, 'translation'), [langs]);

  const [spkSel, setSpkSel] = useState<number | null>(null);
  const [spkMute] = useState<Set<number>>(() => new Set());
  const [castByLang, setCastByLang] = useState<Record<string, Record<number, string>>>({});
  const spkRoster = useMemo(() => speakerRoster(rows, model, t.vcUnknownSpk), [rows, model, t]);
  const spkCastOn = gVoicePick && spkRoster.filter((p) => p.key >= 0).length > 1;
  const spkSelected = spkSel != null && spkRoster.some((p) => p.key === spkSel) ? spkSel : spkRoster[0]?.key ?? null;
  const cast = useMemo(() => {
    const out = autoCast(spkRoster, gvList, cloneOn);
    for (const [k, v] of Object.entries(castByLang[vLang ?? ''] ?? {})) out.set(Number(k), v);
    return out;
  }, [spkRoster, gvList, castByLang, vLang, cloneOn]);
  const castChosen = spkCastOn && Object.keys(castByLang[vLang ?? ''] ?? {}).length > 0;
  const stockCast = useMemo(() => (stockVoices && !castChosen ? autoCast(spkRoster, gvList, false) : null), [stockVoices, castChosen, spkRoster, gvList]);
  const castKeyStr = useMemo(() => (castChosen ? castKey(cast) || null : stockCast ? castKey(stockCast) || null : null), [castChosen, cast, stockCast]);
  const sentCast = castChosen ? cast : stockCast;
  const hasClone = gvList.some((v) => v.cloned && v.consent !== 'pending');
  const canSpeak = !!lang && !!langs?.voice.includes(lang);
  const speakHere = canSpeak && !hearOriginal;
  const sentenceIds = useMemo(
    () => rows.filter((r) => !r.suppressed && !r.unclear).map((r) => r.sentenceId).filter((id): id is number => id != null),
    [rows],
  );
  const arch = useArchiveVoice({ consent, recordingId, lang, ended, cred, pickedVoice: forcedVoice || (castKeyStr ?? picked), sentenceIds: ended && speakHere ? sentenceIds : undefined });
  const gvPicked = gvList.find((v) => v.id === picked) ?? gvList.find((v) => v.id === arch.track?.voice) ?? gvList.find((v) => v.default) ?? gvList[0] ?? null;
  const gvId = gvPicked?.id ?? null;

  useEffect(() => {
    if (!arch.rendering) return;
    const id = setInterval(arch.reload, 4000);
    return () => clearInterval(id);
  }, [arch.rendering, arch.reload]);

  const clipKey = `${recordingId ?? ''}|${lang ?? ''}|${forcedVoice || (castKeyStr ?? picked ?? arch.track?.voiceKey ?? 'default')}`;
  const vp = useTxVoicePlayer(arch.clips, rows, lenS, clipKey, spkMute, arch.track?.wordTimes, timed, arch.coming);
  useEffect(() => { const id = rows[vp.idx]?.sentenceId; if (id != null) arch.setNear(id); }, [vp.idx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!want || !vp.has) return;
    setWant(false);
    if (!vp.playing) vp.toggle();
  }, [want, vp.has]); // eslint-disable-line react-hooks/exhaustive-deps

  const rendering = arch.rendering;
  const failed = rendering ? null : arch.failed ?? null;
  const noVoice = false;
  const speaks = on && speakHere;
  const relang = on && !original && speakHere
    && !(arch.listed && arch.listed.lang === lang && arch.listed.recordingId === recordingId);
  const player: TxPlayer = {
    ...vp,
    has: vp.has || (speaks && ended),
    toggle: () => {
      if (!vp.has && !vp.playing) { setWant(true); return; }
      vp.toggle();
    },
    pause: () => { setWant(false); vp.pause(); },
  };

  const openPicker = () => setPicker(true);
  const closePicker = () => { setPicker(false); setSheet(fromVoices); setFromVoices(false); };
  const selectLang = (c: string | null) => {
    setPickedLang(c);
    pushRecent(c);
    if (side && !fromVoices) return;
    if (c != null) { closePicker(); return; }
    preview.reset();
    setPicker(false);
    setSheet(false);
    setFromVoices(false);
  };
  const openVoices = () => { preview.reset(); setSheet(true); };
  const closeVoices = () => { preview.reset(); setSheet(false); };
  const pickerMine = picker && !fromVoices;
  const voicesMine = sheet || (picker && fromVoices);
  const toggleChip = () => {
    if (pickerMine) { setPicker(false); return; }
    preview.reset(); setSheet(false); setFromVoices(false); setPicker(true);
  };
  const toggleVoices = () => {
    preview.reset();
    if (voicesMine) { setSheet(false); setPicker(false); setFromVoices(false); return; }
    setPicker(false); setFromVoices(false); setSheet(true);
  };
  const pickVoice = (id: string) => {
    preview.reset();
    setSheet(spkCastOn);
    if (lang !== vLang || original) setPickedLang(vLang);
    arch.forget();
    setWant(true);
    if (spkCastOn && spkSelected != null && vLang) {
      const next = new Map(cast);
      next.set(spkSelected, id);
      setCastByLang((m) => ({ ...m, [vLang]: Object.fromEntries(next) }));
      setPicked(null);
      return;
    }
    setPicked(id);
  };

  const chipMeta = original ? { ...langMeta(langs, null), flag: <Icon d={D.langAuto} size={21} sw={1.7} style={{ color: 'currentColor', display: 'block' }} /> } : meta;
  const chip = canTranslate ? (side ? (
    <span className="barchip" style={pickerMine ? { background: 'var(--brand-tint)', boxShadow: '0 0 0 1.5px var(--brand)' } : undefined}>
      <LanguageChip flag={chipMeta.flag} code={chipMeta.code} bordered={false} onClick={toggleChip} flagOnly label={chipMeta.label} />
    </span>
  ) : <LanguageChip flag={chipMeta.flag} code={chipMeta.code} bordered={false} onClick={openPicker} flagOnly label={chipMeta.label} />) : null;
  const glyph = D.voiceClone;
  const active = on && (!!arch.track || rendering);
  const glyphFg = failed ? 'var(--conf-low)' : active || (side && voicesMine) ? 'var(--brand)' : 'var(--ink-55)';
  const waitKind = voiceWait({ on, want, relang, playing: vp.playing, preparing: !!vp.preparing, starting: vp.starting });
  const [lineHeld] = useHeld(waitKind === 'line', 400);
  const voiceWaiting = waitKind === 'asked' || (waitKind === 'line' && lineHeld);
  const busy = rendering || voiceWaiting;
  const voiceTitle = waitKind === 'asked'
    ? VOICE_WAIT_TITLE
    : vp.preparing
    ? `Speaking this line in ${gvPicked?.name ?? 'this voice'}…`
    : rendering
      ? `Preparing this recording in ${gvPicked?.name ?? 'this voice'} — it will play as soon as it is ready`
      : failed
        ? `This voice could not be prepared: ${failed}`
        : !canSpeak
          ? `${t.vcNoVoice}${meta.label}`
          : gVoicePick
            ? 'Choose a voice'
            : gvPicked
              ? gvPicked.name
              : t.vcNoVoice + meta.label;
  const pickerEl = (
      <LanguagePicker open={picker} onClose={closePicker} keepOpen={!!side && !fromVoices} value={original ? null : lang} onSelect={selectLang} languages={trLangs} title={side?.title ?? 'LANGUAGE'} note={side?.note ?? TX_PICKER_NOTE} searchPlaceholder={t.search} none="Original" pinned={(original ? srcLang : lang) ? [(original ? srcLang : lang)!] : []} recent={recent} requireVoice={fromVoices} sticky={stickyPicker} busy={pickerBusy} />
  );
  const savedClones = useMemo(() => gvList.filter((v) => v.cloned && !v.auto), [gvList]);
  const savedFor = (sp: CastMember) => (sp.voiceId ? savedClones.find((v) => v.id === `clone:${sp.voiceId}`) ?? null : null);
  const people = useMemo(() => spkRoster.filter((p2) => p2.key >= 0), [spkRoster]);
  const sheetList = useMemo(() => {
    const stock = gvList.filter((v) => !v.cloned);
    if (!spkCastOn) return [...stock, ...(ended && people.length === 1 ? savedClones.filter((v) => v.id === `clone:${people[0].voiceId}`) : [])];
    const own: AvailableVoice[] = [];
    for (const sp of people) {
      if (savedFor(sp)) continue;
      const auto = gvList.find((v) => v.cloned && v.auto && v.speaker === sp.key);
      if (!auto || auto.ready === false || (auto.consent === 'pending' && !pendingClones)) continue;
      own.push({ id: auto.id, name: sp.name, cloned: true, default: false, live: true, auto: true, gender: sp.sex ?? auto.gender ?? null, speaker: sp.key, consent: auto.consent ?? null });
    }
    return [...stock, ...savedClones, ...own];
  }, [gvList, savedClones, spkCastOn, people, pendingClones, ended]); // eslint-disable-line react-hooks/exhaustive-deps
  const selSp = spkCastOn ? people.find((p2) => p2.key === spkSelected) ?? null : null;
  const soleSp = !spkCastOn && gVoicePick && people.length === 1 && !gvList.some((v) => v.cloned && v.auto && v.speaker === people[0].key) ? people[0] : null;
  const noteSp = selSp ?? soleSp;
  const genderOf = (id: string | undefined) => (id ? gvList.find((v) => v.id === id)?.gender ?? null : null);
  const selSex = selSp ? selSp.sex ?? genderOf(cast.get(selSp.key)) : null;
  const shownList = useMemo(() => {
    if (!selSp) return sheetList;
    return sheetList.filter((v) => (v.cloned ? (v.live ? v.speaker === selSp.key : v.id === `clone:${selSp.voiceId}`) : true));
  }, [sheetList, selSp, selSex, people]); // eslint-disable-line react-hooks/exhaustive-deps
  const autoOf = (key: number) => gvList.find((v) => v.cloned && v.auto && v.speaker === key) ?? null;
  const ctx: VoiceSheetCtx = { people, gvList, autoOf, savedFor };
  const toClone = badge?.(ctx) ?? 0;
  const warns = castWarn ? people.map((p2) => castWarn(p2, ctx)).filter((w): w is string => !!w) : [];
  const voiceBtn = (
    <button type="button" className="txvoice" aria-label="Voice" aria-pressed={side ? voicesMine : undefined} aria-busy={busy || undefined} title={busy || failed ? voiceTitle : undefined} style={{ cursor: 'pointer', background: active || busy || (side && voicesMine) ? 'var(--brand-tint)' : 'var(--fill-06)', boxShadow: side && voicesMine ? 'inset 0 0 0 1.5px var(--brand)' : undefined }} onClick={side ? toggleVoices : openVoices}>
      <Icon d={glyph} size={17} sw={1.6} style={{ color: glyphFg }} />
      {busy && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', borderRadius: '50%', border: '2px solid var(--fill-12)', borderTopColor: 'var(--brand)', animation: 'vs-spin .7s linear infinite', pointerEvents: 'none' }} />}
      {warns.length > 0
        ? <span className="txvoice__warn" title={warns.join(' · ')}>!</span>
        : !!toClone && <span className="txvoice__n" title={`${toClone} speaker${toClone === 1 ? '' : 's'} can get a cloned voice`}>{toClone}</span>}
    </button>
  );
  const voiceSheetEl = (
    <Sheet open={sheet} onClose={closeVoices} title={t.vcSheet} titleNode={voiceTitleNode} doneLabel={t.done}>
      <VoiceSheetBody
        t={t}
        cast={spkCastOn && (
          <SpeakerCast
            t={t}
            roster={spkRoster}
            selected={spkSelected}
            onSelect={(k) => { preview.reset(); setSpkSel(k); onSelectSpeaker?.(k); }}
            noClone={(p2) => !!castNoClone?.(p2, ctx)}
            short={(p2) => !!castShort?.(p2, ctx)}
            warn={(p2) => castWarn?.(p2, ctx) ?? null}
            building={(p2) => !savedFor(p2) && (gvList.some((v) => v.cloned && v.speaker === p2.key && v.ready === false) || !!castBuilding?.(p2, ctx))}
            sexOf={(p2) => p2.sex ?? genderOf(cast.get(p2.key))}
          />
        )}
        voices={shownList}
        onAdd={(v) => { preview.reset(); onAddVoice?.(v); }}
        noClone={noteSp && !shownList.some((v) => v.cloned) ? noCloneFor?.(noteSp, autoOf(noteSp.key), ctx) ?? null : null}
        usedBy={spkCastOn && spkSelected != null
          ? (v) => {
              const also = spkRoster.filter((p) => p.key !== spkSelected && cast.get(p.key) === v.id);
              return also.length ? also.map((p) => p.name).join(', ') : null;
            }
          : undefined}
        foldKey={spkSelected}
        foldFor={selSex}
        currentId={spkCastOn && spkSelected != null ? cast.get(spkSelected) ?? null : gvId}
        armedId={preview.armId}
        sampleId={preview.sampleId}
        dlId={preview.dlId}
        onPick={(v) => { if (preview.sampleId === v.id || preview.dlId === v.id) { preview.stop(); return; } if (onPickVoice?.(v) === false) { preview.reset(); return; } preview.arm(v); }}
        onUse={pickVoice}
      />
    </Sheet>
  );
  const sheets = side ? null : <>{pickerEl}{voiceSheetEl}</>;
  const sidePanel = side && (picker || sheet) ? <div className="vs-side">{picker ? pickerEl : voiceSheetEl}</div> : null;
  const playTitle = !speaks
    ? null
    : failed
        ? `This voice could not be prepared: ${failed}`
        : voiceWaiting && (want || vp.playing)
          ? VOICE_WAIT_TITLE
          : null;
  const noVoiceNote = noVoice && (
    <div className="novoice" title={NO_VOICE_TIP}>
      <Icon d={D.headphonesOff} size={17} sw={1.6} style={{ flex: 'none', color: 'var(--ink-45)' }} />
      <span className="novoice__text">{`${t.vcNoVoice}${meta.label} yet — this transcript can be read, not played.`}</span>
    </div>
  );
  return {
    barChip: { flag: chipMeta.flag, code: chipMeta.code, label: chipMeta.label, onClick: side || stickyPicker ? toggleChip : openPicker, active: !!((side || stickyPicker) && pickerMine), can: canTranslate },
    sheetsOpen: picker || sheet,
    on: speaks, player, chip, voiceBtn, nearRow: arch.setNear, clipsReady: vp.has, clipFor: (id: number | null | undefined) => id != null && arch.clips.some((c) => c.sentenceId === id), voiceWaiting: busy, sheets, sidePanel, voicesMine, toggleVoices, cloningOn: cloneOn, playTitle, noVoice, noVoiceNote, relang, sampling: preview.sampleId != null, error: preview.error, clearError: () => preview.clearError(), openVoices, openPicker, original, reloadVoices: () => setCatVer((n) => n + 1), voicesVer: catVer, people, gvList, autoOf, savedFor, closeVoices, setSheet,
    selectedSpeaker: selSp, armVoice: preview.arm, resetPreview: preview.reset, armedId: preview.armId, resetCast: () => setCastByLang((m) => ({ ...m, [vLang ?? '']: {} })),
    readLang: typeof pickedLang === 'string' && pickedLang !== srcLang ? pickedLang : null,
    readVoiceKey: forcedVoice || (castKeyStr ?? picked ?? arch.track?.voiceKey ?? ''),
    pickedVoiceKey: castKeyStr ?? picked ?? null,
    readVoiceName: gvPicked?.name ?? null,
    canSpeak,
    requestTrack: () => arch.requestRender(castKeyStr ?? picked, castKeyStr ? sentCast : null),
    hasClone,
    clips: arch.clips,
    setNear: arch.setNear,
    closePicker: () => { if (pickerMine) closePicker(); },
  };
}

function hitParts(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text;
  const low = text.toLowerCase();
  const on = new Array<boolean>(text.length).fill(false);
  for (const n of terms) for (let k = low.indexOf(n); k >= 0; k = low.indexOf(n, k + 1)) on.fill(true, k, k + n.length);
  if (!on.includes(true)) return text;
  const out: React.ReactNode[] = [];
  let a = 0;
  for (let b = 1; b <= text.length; b++) {
    if (b < text.length && on[b] === on[a]) continue;
    out.push(on[a] ? <mark key={a} className="txhit">{text.slice(a, b)}</mark> : text.slice(a, b));
    a = b;
  }
  return out;
}

export function TxLines({ model, rows, player, fixed, applied, onFixOpen, onWord, onFix, fixMode, fixingId, marks = true, fixBadges = true, tail, tailFg, running, desk, feedRef, listener, showLabels, find, findOpen, lang, warm, onVisible, wordHl = true }: { model: Model; rows: Row[]; player: TxPlayer; fixed?: Set<string>; applied?: Correction[]; onFixOpen?: (r: Row, hist: boolean) => void; onWord?: (r: Row, w: Word) => void; onFix?: (r: Row) => void; fixMode?: boolean; fixingId?: string | null; marks?: boolean; fixBadges?: boolean; tail: string; tailFg: string; running?: boolean; desk: boolean; feedRef: React.RefObject<HTMLDivElement>; listener?: boolean; showLabels: boolean; find?: string; findOpen?: boolean; lang?: string | null ; warm?: boolean; onVisible?: (ids: number[]) => void; wordHl?: boolean }) {
  const { playing, engaged, t, idx, seekN, wordSync, clipPos } = player;
  useDragScroll(true, feedRef);
  const thumbRef = useRef<HTMLDivElement>(null);
  useFeedBar(feedRef, thumbRef);
  const [hovId, setHovId] = useState<string | null>(null);
  const needle = (find ?? '').trim().toLowerCase();
  const hitTerms = needle.split(/\s+/).filter(Boolean);
  const [off, setOff] = useState<-1 | 0 | 1>(0);
  const glideUntil = useRef(0);
  const glide = useRef<number | null>(null);
  const lastIdx = useRef(idx);
  const rowEl = (i: number) => feedRef.current?.querySelector<HTMLElement>(`[data-tx-row="${i}"]`) ?? null;
  const visKey = useRef('');
  useEffect(() => {
    const el = feedRef.current;
    if (!el || !onVisible) return;
    const measure = () => {
      const b = el.getBoundingClientRect();
      const ids: number[] = [];
      for (const c of Array.from(el.querySelectorAll<HTMLElement>('[data-sentence]'))) {
        const r = c.getBoundingClientRect();
        if (r.bottom > b.top && r.top < b.bottom) ids.push(Number(c.dataset.sentence));
      }
      const key = ids.join(',');
      if (key === visKey.current) return;
      visKey.current = key;
      onVisible(ids);
    };
    const t = window.setTimeout(measure, 120);
    let h: number | undefined;
    const onScroll = () => { window.clearTimeout(h); h = window.setTimeout(measure, 120); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.clearTimeout(t); window.clearTimeout(h); el.removeEventListener('scroll', onScroll); };
  }, [rows, onVisible, feedRef]);
  const centre = (i: number) => {
    const el = feedRef.current, row = rowEl(i);
    if (!el || !row) return;
    const top = row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    const ins = feedInset(el);
    const visH = Math.max(80, el.clientHeight - ins.top - ins.bottom);
    const lead = row.offsetHeight > visH ? 8 : (visH - row.offsetHeight) / 2;
    el.scrollTop = Math.max(0, Math.min(max, top - ins.top - lead));
  };
  const rowOffscreen = (i: number): -1 | 0 | 1 => {
    const el = feedRef.current, row = rowEl(i);
    if (!el || !el.clientHeight || !el.offsetParent || !row) return 0;
    const r = row.getBoundingClientRect(), b = el.getBoundingClientRect();
    const ins = feedInset(el);
    const top = b.top + ins.top, bot = b.bottom - ins.bottom;
    if (r.height > bot - top) return r.top < top - 4 ? -1 : r.top > bot - 60 ? 1 : 0;
    if (r.bottom < top + 10) return -1;
    if (r.bottom > bot - 4) return 1;
    return 0;
  };
  const smoothRow = (i: number) => {
    glideUntil.current = performance.now() + 420;
    const el = feedRef.current, row = rowEl(i);
    if (!el || !el.clientHeight || !row) return;
    const r = row.getBoundingClientRect(), b = el.getBoundingClientRect();
    const max = el.scrollHeight - el.clientHeight;
    const from = el.scrollTop;
    const ins = feedInset(el);
    const visH = Math.max(80, el.clientHeight - ins.top - ins.bottom);
    const lead = r.height > visH ? 8 : (visH - r.height) / 2;
    const to = Math.max(0, Math.min(max, from + (r.top - b.top) - ins.top - lead));
    if (glide.current) cancelAnimationFrame(glide.current);
    if (Math.abs(to - from) < 2) { el.scrollTop = to; glide.current = null; return; }
    const t0 = performance.now(), ms = 360;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      el.scrollTop = from + (to - from) * (1 - Math.pow(1 - k, 3));
      glide.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    glide.current = requestAnimationFrame(step);
  };
  useEffect(() => () => { if (glide.current) cancelAnimationFrame(glide.current); }, []);
  const offRef = useRef<-1 | 0 | 1>(0);
  useEffect(() => {
    if (!playing) { lastIdx.current = idx; offRef.current = 0; setOff(0); return; }
    const check = () => {
      const moved = idx !== lastIdx.current;
      lastIdx.current = idx;
      let o: -1 | 0 | 1 = performance.now() < glideUntil.current ? 0 : rowOffscreen(idx);
      if (moved && o && !offRef.current) { centre(idx); o = 0; }
      offRef.current = o;
      setOff(o);
    };
    check();
    const h = setInterval(check, 200);
    return () => clearInterval(h);
  }, [idx, playing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (seekN) smoothRow(idx); }, [seekN]); // eslint-disable-line react-hooks/exhaustive-deps
  const followJump = () => { smoothRow(idx); offRef.current = 0; setOff(0); };
  const follow = (dir: 'up' | 'down') => (
    <div className={`txfollow txfollow--${dir}`}>
      <button type="button" className="txfollow__pill" title="Jump to the line playing now" onClick={followJump}>
        <Icon d={dir === 'up' ? 'm4.5 15.75 7.5-7.5 7.5 7.5' : 'm19.5 8.25-7.5 7.5-7.5-7.5'} size={15} sw={2} />Now playing
      </button>
    </div>
  );
  return (
    <div ref={feedRef} data-tx-feed="1" className={`txfeed${desk ? ' txfeed--desk' : ''}${findOpen && !running ? ' is-find' : ''}`}>
      <FeedBar thumbRef={thumbRef} />
      {playing && off === -1 && follow('up')}
      {rows.map((r, i) => {
        const on = playing && i === idx;
        const held = engaged && i === idx;
        const fixing = !!fixingId && fixingId === r.id;
        const dim = !engaged || i <= idx || fixing ? 1 : 0.38;
        const tapRow = listener ? () => player.playRow(i)
          : fixMode && onFix ? () => { if (playing && !on) player.seekRow(i); onFix(r); }
          : playing && on ? undefined : () => player.playRow(i);
        const fx = listener ? null : rowFixes(r, applied, fixed);
        const fxAny = !!fx && (fx.script > 0 || fx.manual);
        const pen = desk && !!onFixOpen && hovId === r.id && !!fx && !fxAny;
        const who = speakerLabel(model, r.speaker);
        const look = speakerLook(model, r.speaker);
        const ln = look.lane;
        const tr = lang && r.translations[lang] && r.language !== lang ? r.translations[lang] : null;
        const words = lineWords(rows, i, lang);
        const spokenWord = held && !wordSync && clipPos ? readCursor(words.map((w) => ({ t: w.text, sp: ' ' })), clipPos) : null;
        return (
          <div key={r.id} data-tx-row={i} data-sentence={r.sentenceId} className={`txline${warm ? ' txline--warm' : ''}${fixing ? ' txline--fixing' : ''}`} aria-current={fixing || undefined} style={{ opacity: dim }} onClick={tapRow} onMouseEnter={desk && onFixOpen ? () => setHovId(r.id) : undefined} onMouseLeave={desk && onFixOpen ? () => setHovId(null) : undefined}>
            <div className="txline__meta">
              <span className="txline__at">{clock(r.start)}</span>
              {showLabels && r.speaker >= 0 && (
                <>
                  <div className={`lanechip bg-lane-${ln}`} style={look.soft ? { background: look.soft, color: look.fg } : undefined}>{speakerInitial(model, r.speaker)}</div>
                  <span className={`txline__who lane-${ln}`} style={look.fg ? { color: look.fg } : undefined}>{who}</span>
                  {look.hasVoice && <VoiceIdGlyph color={look.fg ?? `var(--lane-${ln})`} />}
                </>
              )}
              {on && <span title="Playing" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center' }}><Icon d={D.headphones} size={desk ? 15 : 14} sw={1.6} stroke={showLabels && r.speaker >= 0 ? look.fg ?? `var(--lane-${ln})` : 'var(--ink-45)'} /></span>}
              {fx && fixBadges && <FixBadges f={fx} desk={desk} onOpen={onFixOpen ? () => onFixOpen(r, true) : undefined} />}
              {pen && <FixPen alone onOpen={() => onFixOpen?.(r, false)} />}
            </div>
            <div className="txline__text">
              {words.map((w, j) => {
                const key = `${w.seq}:${w.idx}`;
                const c = confClass(w.prob);
                const tracks = held && wordHl;
                const at = tracks && (wordSync
                  ? t >= w.start && (t < w.end || j === words.length - 1 || t < words[j + 1].start)
                  : j === spokenWord);
                const ahead = tracks && !at && (wordSync ? w.start > t : spokenWord != null && j > spokenWord);
                const fx = !tr && !listener && (!!fixed?.has(key) || !!w.script);
                const dash = !tr && !listener && marks && !!c && !fx;
                const half = dash ? (c === 'low' ? 'var(--conf-low-half)' : 'var(--conf-mid-half)') : null;
                const fg = fx ? 'var(--brand)' : ahead ? 'var(--ink-40)' : half ?? 'var(--ink-96)';
                return (
                  <span key={key + j}>
                    <span
                      className="txw"
                      title={onWord && !tr ? (fixMode ? 'Correct this word' : on ? (playing && player.seekWord ? 'Play from this word' : 'Play from this line') : 'Play from this line') : on ? '' : 'Play from this line'}
                      onClick={onWord && !tr ? (e) => { e.stopPropagation(); if (fixMode) { onWord(r, w); return; } if (playing && on) { player.seekWord?.(w); return; } player.playRow(i); } : undefined}
                      style={{ color: fg, opacity: ahead ? 0.45 : 1, fontWeight: 300, cursor: onWord && !tr ? (fixMode || !on || !playing || player.seekWord ? 'pointer' : 'default') : on ? 'default' : 'pointer', textShadow: at ? '0 0 2px currentColor, 0 0 4px currentColor' : 'none', textDecorationLine: dash || fx ? 'underline' : 'none', textDecorationStyle: fx ? 'solid' : 'dotted', textDecorationColor: fx ? 'var(--brand)' : half ?? 'currentColor', textDecorationThickness: dash || fx ? '1.5px' : undefined, textUnderlineOffset: dash || fx ? '3px' : undefined }}
                    >{hitParts(w.text, hitTerms)}</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}> </span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      {running
        ? <div className="txtail txtail--wave" title="Still transcribing"><span className="eq3" aria-hidden="true"><span /><span /><span /></span></div>
        : <div className="txtail" style={{ color: tailFg }}>{tail}</div>}
      {playing && off === 1 && follow('down')}
    </div>
  );
}

export interface FindState { hits: number; at: number; step: (dir: 1 | -1) => void }
export function TxFind({ open, q, onQ, onClose, hits, desk, inline, flash }: { open: boolean; q: string; onQ: (q: string) => void; onClose: () => void; hits: number | FindState; desk: boolean; inline?: boolean; flash?: string | null }) {
  const nav = typeof hits === 'number' ? null : hits;
  const total = nav ? nav.hits : (hits as number);
  return (
    <div className={inline ? 'searchbar searchbar--inline' : `searchbar searchbar--float${desk ? ' searchbar--desk' : ''}${open ? '' : ' is-hidden'}`}>
      <div>
        <Icon d={D.search} size={16} sw={1.7} style={{ color: 'var(--ink-45)', flex: 'none' }} />
        <input value={q} onChange={(e) => onQ(e.target.value)} onKeyDown={(e) => {
          if (e.key === 'Enter' && nav) { e.preventDefault(); if (total) nav.step(e.shiftKey ? -1 : 1); return; }
          if (e.key !== 'Escape') return; e.stopPropagation(); if (q) onQ(''); else onClose();
        }} placeholder="Search this transcript" />
        {inline && flash && <span className="searchbar__flash">{flash}</span>}
        {q.trim() && <span className="count">{nav ? findCount(nav.at, total) : `${total} found`}</span>}
        {q.trim() && nav && (
          <>
            <button type="button" className="searchbar__x searchbar__step" disabled={!total} onClick={() => nav.step(-1)} aria-label="Previous match" title="Previous match (Shift+Enter)"><Icon d={D.chevronUp} size={15} sw={1.8} /></button>
            <button type="button" className="searchbar__x searchbar__step" disabled={!total} onClick={() => nav.step(1)} aria-label="Next match" title="Next match (Enter)"><Icon d={D.chevronDown} size={15} sw={1.8} /></button>
          </>
        )}
        {q.trim() && <button type="button" className="searchbar__x" onClick={() => onQ('')} aria-label="Clear" title="Clear"><Icon d={D.close} size={15} sw={1.7} /></button>}
      </div>
    </div>
  );
}
export function useFindPull(feedRef: React.RefObject<HTMLDivElement>, rows: Row[], open: boolean, q: string, setOpen: (v: boolean) => void, lang?: string | null): FindState {
  const openRef = useRef(open); openRef.current = open;
  const qRef = useRef(q); qRef.current = q;
  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => findMatches(rows, needle, lang), [rows, needle, lang]);
  const [curId, setCurId] = useState<string | null>(null);
  const [seek, setSeek] = useState(0);
  const at = matchAt(rows, matches, curId);
  const rowIdx = at >= 0 ? matches[at] : -1;
  useEffect(() => {
    setCurId(matches.length ? rows[matches[0]].id : null);
    if (matches.length) setSeek((n) => n + 1);
  }, [needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = useCallback((dir: 1 | -1) => {
    const next = stepMatch(at, matches.length, dir);
    if (next < 0) return;
    setCurId(rows[matches[next]].id);
    setSeek((n) => n + 1);
  }, [at, matches, rows]);
  useEffect(() => {
    const el = feedRef.current;
    const row = rowIdx >= 0 ? el?.querySelector<HTMLElement>(`[data-tx-row="${rowIdx}"]`) : null;
    if (!seek || !el || !row) return;
    const ins = feedInset(el);
    const visH = Math.max(80, el.clientHeight - ins.top - ins.bottom);
    const r = row.getBoundingClientRect(), b = el.getBoundingClientRect();
    const lead = r.height > visH ? 8 : (visH - r.height) / 2;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTo({ top: Math.max(0, Math.min(max, el.scrollTop + (r.top - b.top) - ins.top - lead)), behavior: 'smooth' });
  }, [seek]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    let last = el.scrollTop, acc = 0, userUntil = 0;
    const touch = () => { userUntil = Date.now() + 1500; };
    const drag = (e: PointerEvent) => { if (e.buttons) touch(); };
    const onScroll = () => {
      const top = el.scrollTop, d = top - last;
      last = top;
      if (Date.now() > userUntil) { acc = 0; return; }
      acc = (d < 0) === (acc < 0) ? acc + d : d;
      if (acc < -14 && !openRef.current) { acc = 0; setOpen(true); }
      else if (acc > 56 && openRef.current && !qRef.current.trim()) { acc = 0; setOpen(false); }
    };
    el.addEventListener('wheel', touch, { passive: true });
    el.addEventListener('touchmove', touch, { passive: true });
    el.addEventListener('pointermove', drag);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', touch);
      el.removeEventListener('touchmove', touch);
      el.removeEventListener('pointermove', drag);
      el.removeEventListener('scroll', onScroll);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => ({ hits: matches.length, at, step }), [matches.length, at, step]);
}

