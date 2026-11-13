import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { liveEmbedUrl } from '../core/youtube';
import type { Correction, LanguageLists, ExportFormat } from '@vocalstack/js-sdk';
import { Card, Eyebrow, IconButton, Sheet, Switch, Toggle, Tooltip } from '../ds/Controls';
import { D, EqBars, Icon, PauseGlyph, PlayGlyph, Spinner } from '../ds/Icons';
import { clock } from '../core/format';
import { confClass, fixedSlots, lane, speakerInitial, speakerNumber, speakerLabel, speakerLook, speakerName, type Lane, type Model, type Row, type Word } from '../core/transcript';
import { audioClipUrl, type MediaCred } from '../core/audio';
import { archiveClips, missingClips, readCursor, readTokens, trackFor, type ReadPos, type VoiceTrackRow } from '../core/voiceplayer';
import { TX_FORMATS } from '../data/tx';
import { describe, useAsync, type ErrorLike } from '../data/transcript';
import { apiFetch, usePlayerApi } from '../data/context';
import type { Strings } from '../data/i18n';

export function feedInset(el: HTMLElement): { top: number; bottom: number } {
  const cs = getComputedStyle(el);
  const cap = el.clientHeight * 0.45;
  return {
    top: Math.min(parseFloat(cs.paddingTop) || 0, cap),
    bottom: Math.min(parseFloat(cs.paddingBottom) || 0, cap),
  };
}

export const NO_VOICE_TIP = 'This language has no synthetic voice yet, so you can read it but not listen.';

export function rowKey(onClick: () => void) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  };
}


export function useFeedBar(ref: React.RefObject<HTMLDivElement>, thumbRef: React.RefObject<HTMLDivElement>, extra = 0) {
  const paintRef = useRef<() => void>(() => {});
  useEffect(() => { paintRef.current(); }, [extra]);
  useEffect(() => {
    const el = ref.current, thumb = thumbRef.current;
    if (!el || !thumb) return;
    const glassBar = (): HTMLElement | null => {
      let n: HTMLElement | null = el.parentElement;
      for (let i = 0; i < 4 && n; i++) {
        const b = n.querySelector<HTMLElement>('[data-transport]');
        if (b) return b;
        n = n.parentElement;
      }
      return null;
    };
    const geom = () => {
      const bar = glassBar();
      const covered = bar ? bar.offsetHeight : 0;
      const vis = el.clientHeight - covered - 36;
      const max = el.scrollHeight - el.clientHeight;
      const size = vis > 0 ? Math.max(30, Math.round(vis * (el.clientHeight - covered) / el.scrollHeight)) : 0;
      return { vis, max, size };
    };
    let want = -1;
    let hide: any = null;
    let dragging = false, from = 0, at = 0;
    const clearGlass = () => {
      const bar = glassBar();
      if (!bar) return;
      const extra = parseFloat(el.dataset.glassExtra || '0') || 0;
      const w = bar.offsetHeight + 14 + extra;
      if (w === want) return;
      want = w;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      el.style.paddingBottom = w + 'px';
      if (atBottom) el.scrollTop = el.scrollHeight;
    };
    const show = () => {
      thumb.style.opacity = '1';
      clearTimeout(hide);
      hide = setTimeout(() => { if (!dragging) thumb.style.opacity = '0'; }, 900);
    };
    let barRO: ResizeObserver | null = null;
    let watched: HTMLElement | null = null;
    const paint = (reveal?: boolean) => {
      clearGlass();
      const bar = glassBar();
      if (bar && bar !== watched && barRO) { watched = bar; barRO.observe(bar); }
      const g = geom();
      if (g.vis < 60 || g.max < 6) { thumb.style.opacity = '0'; thumb.style.pointerEvents = 'none'; return; }
      thumb.style.pointerEvents = 'auto';
      thumb.style.height = g.size + 'px';
      thumb.style.transform = 'translateY(' + Math.round((el.scrollTop / g.max) * (g.vis - g.size)) + 'px)';
      if (reveal) show();
    };
    const gutter = parseFloat(getComputedStyle(el).paddingRight) || 0;
    thumb.style.right = (gutter >= 12 ? -(gutter - 6) : 2) + 'px';
    const onScroll = () => paint(true);
    const down = (e: PointerEvent) => {
      const g = geom();
      if (g.vis - g.size <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      dragging = true;
      from = e.clientY;
      at = el.scrollTop;
      thumb.style.cursor = 'grabbing';
      show();
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const g = geom();
      el.scrollTop = at + ((e.clientY - from) / (g.vis - g.size)) * g.max;
      show();
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      thumb.style.cursor = 'grab';
      show();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    thumb.addEventListener('pointerdown', down);
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
    if (typeof ResizeObserver !== 'undefined') {
      barRO = new ResizeObserver(() => paint());
      barRO.observe(el);
    }
    paintRef.current = () => paint();
    paint();
    return () => {
      paintRef.current = () => {};
      el.removeEventListener('scroll', onScroll);
      thumb.removeEventListener('pointerdown', down);
      thumb.removeEventListener('pointermove', move);
      thumb.removeEventListener('pointerup', end);
      thumb.removeEventListener('pointercancel', end);
      barRO?.disconnect();
      clearTimeout(hide);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function FeedBar({ thumbRef }: { thumbRef: React.RefObject<HTMLDivElement> }) {
  return <div className="feedbar" aria-hidden="true"><div ref={thumbRef} className="feedbar__thumb" /></div>;
}

export function Toast({ error, onClose }: { error: ErrorLike | null; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedT = useRef<number>();
  useEffect(() => { setCopied(false); setHover(false); window.clearTimeout(copiedT.current); }, [error]);
  useEffect(() => () => window.clearTimeout(copiedT.current), []);
  useEffect(() => {
    if (!error || hover || copied) return;
    const t = setTimeout(() => closeRef.current(), 10500);
    return () => clearTimeout(t);
  }, [error, hover, copied]);
  if (!error) return null;
  const copy = () => {
    const text = error.requestId ? `${error.message}\nRequest id: ${error.requestId}` : error.message;
    void navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.clearTimeout(copiedT.current); copiedT.current = window.setTimeout(() => setCopied(false), 1800); }, () => {});
  };
  const credit = error.code === 'insufficient_credit' || error.code === 'quota_exceeded' || error.status === 402;
  return (
    <div className="toast" role="alert" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      <Icon d={D.warn} size={16} style={{ color: 'var(--conf-low)', flex: 'none' }} />
      <span style={{ flex: 1 }}>{error.message}{credit && <> <a href="https://app.vocalstack.com/billing" target="_blank" rel="noopener" className="dev-link" style={{ fontSize: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>Add credit</a></>}</span>
      <button type="button" onClick={copy} aria-label={copied ? 'Copied' : 'Copy error'} title={copied ? 'Copied' : 'Copy error'}><Icon d={copied ? D.check : D.copy} size={14} /></button>
      <button type="button" onClick={onClose} aria-label="Dismiss"><Icon d={D.close} size={14} /></button>
    </div>
  );
}


export function SpeakerTag({ model, speaker, showLabels, pending, diarized }: { model: Model; speaker: number; showLabels: boolean; pending?: boolean; diarized?: boolean }) {
  if (speaker < 0) {
    if (!showLabels) return null;
    if (!pending) {
      if (!diarized) return null;
      return (
        <>
          <span className="lanechip lanechip--unknown">?</span>
          <span className="line__who line__who--unknown">Unknown Speaker</span>
        </>
      );
    }
    return (
      <span className="whopending" aria-hidden="true">
        <span className="whopending__ghost"><span style={{ width: 9, height: 9 }} /><span className="line__who">Speaker 1</span></span>
        <span className="whopending__live"><span className="whopending__chip" /><span className="whopending__pill" /></span>
      </span>
    );
  }
  if (!showLabels) return null;
  const look = speakerLook(model, speaker);
  const l = look.lane;
  return (
    <>
      <span className={`lanechip bg-lane-${l}`} style={look.soft ? { background: look.soft, color: look.fg } : undefined}>
        {speakerInitial(model, speaker)}
      </span>
      <span className={`line__who lane-${l}`} style={look.fg ? { color: look.fg } : undefined}>
        {speakerLabel(model, speaker)}
      </span>
      {look.hasSavedSpeaker && <VoiceIdGlyph color={look.fg ?? `var(--lane-${l})`} />}
    </>
  );
}

export function VoiceIdGlyph({ color }: { color: string }) {
  return (
    <span title="Cloned voice" style={{ flex: 'none', display: 'inline-flex' }}>
      <Icon d={D.voiceClone} size={13} sw={1.7} stroke={color} />
    </span>
  );
}

export function Transport({ chip, note, scrub, mute, voice, prev, play, next }: { chip: ReactNode; note?: ReactNode; scrub: ReactNode; mute: ReactNode; voice: ReactNode; prev: ReactNode; play: ReactNode; next: ReactNode }) {
  return (
    <div className="vs-tt">
      <div className="vs-tt__r1">
        <div className="vs-tt__chip">{chip}</div>
        {note ? <div className="vs-tt__scrub">{note}</div> : (
          <>
            <div className="vs-tt__scrub">{scrub}</div>
            <div className="vs-tt__spk">{mute}</div>
            <div className="vs-tt__voice">{voice}</div>
          </>
        )}
      </div>
      {!note && (
        <div className="vs-tt__r2">
          <div className="vs-tt__side" style={{ justifyContent: 'flex-end' }}><div className="vs-tt__prev">{prev}</div></div>
          <div className="vs-tt__play">{play}</div>
          <div className="vs-tt__side" style={{ justifyContent: 'flex-start' }}><div className="vs-tt__next">{next}</div></div>
        </div>
      )}
    </div>
  );
}

export function ReplayScrub({ index, total, atLabel, durLabel, stepLabel, onSeek, onSeekFrac, onScrubStart, onScrubEnd, frac, glideMs = 260 }: { index: number; total: number; atLabel: string; durLabel: string; stepLabel: string; onSeek: (i: number) => void; onSeekFrac?: (f: number) => void; onScrubStart?: () => void; onScrubEnd?: () => void; frac?: number; glideMs?: number }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const [held, setHeld] = useState<number | null>(null);
  const n = Math.max(1, total);
  const shown = held ?? frac;
  const pct = shown != null ? Math.min(100, Math.max(0, shown * 100)) : (index / Math.max(1, n - 1)) * 100;
  const glide = frac != null && glideMs > 0 && held == null ? `width ${glideMs}ms linear, left ${glideMs}ms linear` : 'none';
  const emit = (e: React.PointerEvent) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
    if (onSeekFrac) { setHeld(f); onSeekFrac(f); return; }
    const i = Math.round(f * (n - 1));
    if (i !== index) onSeek(i);
  };
  const up = () => { if (!drag.current) return; drag.current = false; setHeld(null); onScrubEnd?.(); };
  return (
    <div className="rscrub">
      <div ref={track} className="rscrub__track"
        onPointerDown={(e) => { drag.current = true; track.current?.setPointerCapture(e.pointerId); onScrubStart?.(); emit(e); e.preventDefault(); }}
        onPointerMove={(e) => { if (drag.current) emit(e); }}
        onPointerUp={up} onPointerCancel={up}>
        <div className="rscrub__rail" />
        <div className="rscrub__fill" style={{ width: `${pct}%`, transition: glide }} />
        <div className="rscrub__knob" style={{ left: `${pct}%`, transition: glide }} />
      </div>
      <div className="rscrub__labels"><span className="at">{atLabel}</span><span className="step">{stepLabel}</span><span className="dur">{durLabel}</span></div>
    </div>
  );
}


export interface RowFixes { script: number; manual: boolean; manualCount: number }

export function rowFixes(r: Row, corrections: Correction[] | undefined, slots?: Set<string>): RowFixes {
  const seqs = new Set(r.seqs ?? r.words.map((w) => w.seq));
  const live = (corrections ?? []).filter((c) => !c.revertedAt && c.seq != null && seqs.has(c.seq) && (c.kind === 'word' || c.kind === 'line'));
  const rewritten = live.some((c) => c.kind === 'line');
  const mine = (w: Word) => !!slots?.has(`${w.seq}:${w.idx}`);
  return {
    script: rewritten ? 0 : r.words.filter((w) => w.script && !mine(w)).length,
    manual: live.length > 0 || (corrections === undefined && r.corrected),
    manualCount: rewritten ? 0 : live.filter((c) => c.kind === 'word').length,
  };
}

export const isFixedWord = (w: Word, slots?: Set<string>, listener = false) => (!listener && !!w.script) || !!slots?.has(`${w.seq}:${w.idx}`);

export function FixBadges({ f, desk, onOpen }: { f: RowFixes; desk?: boolean; onOpen?: () => void }) {
  const one = (label: string, n: number, first: boolean) => (
    <span key={label} role="button" title="Open this line in Fix" className="badge badge--fix" style={{ marginLeft: first ? 'auto' : 0 }} onClick={(e) => { e.stopPropagation(); onOpen?.(); }}>
      <Icon d={D.pencilFix} size={desk ? 10 : 9} sw={2} />{label}{n > 0 && <span className="badge__n">{n}</span>}
    </span>
  );
  return (
    <>
      {f.script > 0 && one(desk ? 'SCRIPT FIX' : 'SCRIPT', f.script, true)}
      {f.manual && one(desk ? 'MANUAL FIX' : 'MANUAL', f.manualCount, f.script === 0)}
    </>
  );
}

export function FixPen({ onOpen, alone }: { onOpen: () => void; alone: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <span role="button" title="Fix this line" className={`badge badge--pen${over ? ' is-over' : ''}`} style={{ marginLeft: alone ? 'auto' : 0 }} onMouseEnter={() => setOver(true)} onMouseLeave={() => setOver(false)} onClick={(e) => { e.stopPropagation(); onOpen(); }}>
      <Icon d={D.pencilFix} size={11} sw={2} />{over && 'FIX'}
    </span>
  );
}

export function CorrectedBadge({ desk }: { desk?: boolean }) {
  return <span className="badge badge--corrected"><Icon d={D.check} size={desk ? 10 : 9} sw={desk ? 2.6 : 3} />CORRECTED</span>;
}

function readStyle(j: number, cursor: number | null, warm: boolean, reading: boolean): React.CSSProperties | undefined {
  if (warm) {
    return { color: 'transparent', WebkitTextFillColor: 'transparent', background: 'var(--fill-10)', borderRadius: '99px', textShadow: 'none', opacity: 1 };
  }
  if (cursor == null) return reading ? { color: 'var(--ink-40)', WebkitTextFillColor: 'var(--ink-40)', opacity: 1 } : undefined;
  if (j > cursor) return { color: 'var(--ink-40)', WebkitTextFillColor: 'var(--ink-40)', opacity: 1 };
  if (j === cursor) return { color: 'var(--ink-96)', WebkitTextFillColor: 'var(--ink-96)', opacity: 1, textShadow: '0 0 2px currentColor, 0 0 4px currentColor' };
  return { color: 'var(--ink-96)', WebkitTextFillColor: 'var(--ink-96)', opacity: 1 };
}

export function TrText({ text, query, pos, warm }: { text: string; query?: string; pos?: ReadPos | null; warm: boolean }) {
  const tokens = useMemo(() => readTokens(text), [text]);
  const cursor = pos ? readCursor(tokens, pos) : null;
  const q = (query ?? '').trim().toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  return (
    <>
      {tokens.map((k, j) => {
        const hit = q.length > 0 && q.some((n) => k.t.toLowerCase().includes(n));
        return <span key={j} className={`rw${hit ? ' w--hit' : ''}`} style={readStyle(j, cursor, warm, !!pos)}>{k.t}{k.sp}</span>;
      })}
    </>
  );
}

export function Words({ words, text, query, colour, tappable, tapAll = false, onWord, corrected, pos = null, warm = false, slots, listener = false, fixes = true }: { fixes?: boolean; slots?: Set<string>; listener?: boolean; words: Word[]; text: string; query?: string; colour: boolean; tappable?: boolean; tapAll?: boolean; onWord?: (w: Word) => void; corrected?: boolean; pos?: ReadPos | null; warm?: boolean }) {
  const cursor = pos ? readCursor(words.length ? words.map((w) => ({ t: w.text, sp: ' ' })) : readTokens(text), pos) : null;
  if (!words.length || (corrected && words.map((w) => w.text).join(' ') !== text)) {
    return <TrText text={text} query={query} pos={pos} warm={warm} />;
  }
  const q = (query ?? '').trim().toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  return (
    <>
      {words.map((w, i) => {
        const fx = fixes && isFixedWord(w, slots, listener);
        const cls = fx ? 'fixed' : colour ? confClass(w.prob) : '';
        const hit = q.length > 0 && q.some((t) => w.text.toLowerCase().includes(t));
        const tap = tapAll || (tappable && cls !== '');
        return (
          <span key={`${w.seq}:${w.idx}`}>
            {i > 0 ? ' ' : ''}
            <span className={`w rw${cls ? ` w--${cls}` : ''}${hit ? ' w--hit' : ''}${tap ? ' w--tap' : ''}`} style={readStyle(i, cursor, warm, !!pos)} onClick={tap && onWord ? (e) => { e.stopPropagation(); onWord(w); } : undefined}>{w.text}</span>
          </span>
        );
      })}
    </>
  );
}

export function worstConf(r: Row): '' | 'mid' | 'low' {
  let worst: '' | 'mid' | 'low' = '';
  for (const w of r.words) {
    const c = confClass(w.prob);
    if (c === 'low') return 'low';
    if (c === 'mid') worst = 'mid';
  }
  return worst;
}


const SETTLE_MS = 400;

export function useViewportTranslation(
  transcriptionId: string | null,
  lang: string | null,
  rows: Row[],
  merge: (lang: string, made: Record<string, string>) => void,
) {
  const api = usePlayerApi();
  const [visible, setVisible] = useState<number[]>([]);
  const [tick, setTick] = useState(0);
  const asked = useRef<Set<string>>(new Set());
  const busy = useRef(false);
  const byId = useMemo(() => new Map(rows.filter((r) => r.sentenceId != null).map((r) => [r.sentenceId!, r])), [rows]);
  useEffect(() => { asked.current = new Set(); }, [transcriptionId, lang]);
  const onVisible = useCallback((ids: number[]) => setVisible(ids), []);
  useEffect(() => {
    if (!transcriptionId || !lang || !visible.length || busy.current) return;
    void tick;
    const want = visible.filter((id) => {
      const r = byId.get(id);
      if (!r || !r.text.trim()) return false;
      if (!r.settled) return false;
      if (r.translations[lang]) return false;
      if (r.language && r.language.slice(0, 2).toLowerCase() === lang.slice(0, 2).toLowerCase()) return false;
      return !asked.current.has(`${lang}:${id}`);
    }).slice(0, 40);
    if (!want.length) return;
    busy.current = true;
    for (const id of want) asked.current.add(`${lang}:${id}`);
    api.client.transcriptions.translation(transcriptionId, lang, want, api.readAs)
      .then((r) => { if (r.translations && Object.keys(r.translations).length) merge(lang, r.translations); })
      .catch((e: unknown) => { const st = (e as { status?: number })?.status; if (st && st >= 400 && st < 500) return; for (const id of want) asked.current.delete(`${lang}:${id}`); })
      .finally(() => { busy.current = false; setTick((n) => n + 1); });
  }, [transcriptionId, lang, visible, tick, byId, merge]); // eslint-disable-line react-hooks/exhaustive-deps
  return onVisible;
}


export interface AvailableVoice {
  id: string;
  name: string;
  cloned: boolean;
  default: boolean;
  previewUrl?: string;
  quality?: 1 | 2 | 3 | null;
  lagS?: number | null;
  accent?: string | null;
  gender?: 'male' | 'female' | null;
  ready?: boolean;
  consent?: 'pending' | 'granted' | null;
  speaker?: number | null;
  auto?: boolean;
  library?: boolean;
  live?: boolean;
}

export function voiceDetail(v: AvailableVoice): string {
  return v.live || v.auto ? 'From this session' : v.cloned ? (v.library === false ? 'This transcription only' : 'Saved in Speakers') : '';
}

function groupOf(v: AvailableVoice, t: Strings): { rank: number; head: string } {
  if (v.cloned) return { rank: 0, head: t.vcSheet };
  if (v.gender === 'male') return { rank: 1, head: t.vcMale.toUpperCase() };
  if (v.gender === 'female') return { rank: 2, head: t.vcFemale.toUpperCase() };
  return { rank: 3, head: t.vcSynth };
}

interface VoiceGroupRow {
  v: AvailableVoice;
  headOn: boolean;
  head: string;
  headCount: number;
  rule: string;
}

export function voiceGroups(list: AvailableVoice[], t: Strings): VoiceGroupRow[] {
  const shown = list.slice().sort((a, b) =>
    groupOf(a, t).rank - groupOf(b, t).rank
    || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const counts: Record<string, number> = {};
  for (const v of shown) { const g = groupOf(v, t).head; counts[g] = (counts[g] ?? 0) + 1; }
  return shown.map((v, i) => {
    const head = groupOf(v, t).head;
    const headOn = i === 0 || groupOf(shown[i - 1], t).head !== head;
    return { v, headOn, head, headCount: counts[head], rule: headOn ? '0' : '1px solid var(--hair)' };
  });
}

export interface CastMember {
  key: number;
  speakerId?: string | null;
  cloneId?: string | null;
  name: string;
  initial: string;
  lane: Lane | null;
  sex?: 'male' | 'female' | null;
  fg?: string;
  soft?: string;
  hasSavedSpeaker?: boolean;
}

export function savedCloneKey(sp: Pick<CastMember, 'cloneId'>): string | null {
  return sp.cloneId ? `clone:${sp.cloneId}` : null;
}

export function speakerRoster(rows: { speaker: number }[], model: Model, unknownLabel: string): CastMember[] {
  const seen = new Set<number>();
  let unknown = false;
  for (const r of rows) { if (r.speaker < 0) unknown = true; else seen.add(r.speaker); }
  const out: CastMember[] = [...seen].sort((a, b) => a - b)
    .map((sp) => {
      const look = speakerLook(model, sp);
      return {
        key: sp,
        name: speakerLabel(model, sp),
        initial: speakerInitial(model, sp),
        lane: look.lane,
        sex: model.speakerSex[sp] ?? null,
        speakerId: model.speakerIds[sp]?.speakerId ?? null,
        cloneId: model.speakerIds[sp]?.cloneId ?? null,
        fg: look.fg,
        soft: look.soft,
        hasSavedSpeaker: look.hasSavedSpeaker,
      };
    });
  if (unknown) out.push({ key: -1, name: unknownLabel, initial: '?', lane: null, sex: null });
  return out;
}

export function castKey(map: Map<number, string>): string {
  const body = [...map.entries()]
    .filter(([, v]) => v.trim())
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}=${v.trim()}`)
    .join(';');
  return body ? `cast:${body}` : '';
}

export function parseCast(key: string | null | undefined): Map<number, string> | null {
  if (!key || !key.startsWith('cast:')) return null;
  const out = new Map<number, string>();
  for (const part of key.slice(5).split(';')) {
    const at = part.indexOf('=');
    if (at < 1) continue;
    const spk = Number(part.slice(0, at));
    const voice = part.slice(at + 1).trim();
    if (Number.isInteger(spk) && voice) out.set(spk, voice);
  }
  return out.size ? out : null;
}

export function autoCast(roster: CastMember[], voices: AvailableVoice[], clones = true): Map<number, string> {
  const pool = voices.filter((v) => !v.cloned);
  const used = new Set<string>();
  const out = new Map<number, string>();
  for (const sp of roster) {
    const key = savedCloneKey(sp);
    const saved = key ? voices.find((v) => v.cloned && !v.auto && v.consent !== 'pending' && v.id === key) : undefined;
    const own = saved ?? (!clones ? undefined : (key ? voices.find((v) => v.cloned && v.consent !== 'pending' && v.id === key) : undefined)
      ?? (sp.key >= 0 ? voices.find((v) => v.cloned && v.auto && v.consent !== 'pending' && v.speaker === sp.key) : undefined));
    if (own) {
      out.set(sp.key, own.id);
      used.add(own.id);
      continue;
    }
    const free = pool.filter((v) => !used.has(v.id));
    const suits = sp.sex ? free.filter((v) => v.gender === sp.sex) : [];
    const pick = suits[0] ?? free[0] ?? pool[0];
    if (!pick) continue;
    out.set(sp.key, pick.id);
    used.add(pick.id);
  }
  return out;
}

const castSlot: React.CSSProperties = { flex: 'none', boxSizing: 'border-box', width: 13, height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' };

export function SpeakerCast({ roster, selected, onSelect, building }: {
  roster: CastMember[];
  selected: number | null;
  onSelect: (key: number) => void;
  building?: (p: CastMember) => boolean;
}) {
  const sel = roster.find((p) => p.key === selected) ?? null;
  const measure = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(1);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const count = () => setRows(new Set([...el.children].map((c) => (c as HTMLElement).offsetTop)).size);
    count();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(count);
    ro.observe(el);
    return () => ro.disconnect();
  }, [roster]);
  const drop = rows > 2;
  useEffect(() => { if (!drop) setOpen(false); }, [drop]);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true); };
  }, [open]);
  if (!roster.length) return null;
  const marks = (p: CastMember, on: boolean) => (p.key >= 0 && !!building?.(p)
    ? <span title="Cloning this voice…" aria-label="Cloning this voice" style={castSlot}><Spinner size={13} color="var(--brand)" track="var(--fill-12)" sw={1.7} /></span>
    : p.hasSavedSpeaker
      ? <VoiceIdGlyph color={p.fg ?? (on ? 'var(--ink-62)' : 'var(--ink-45)')} />
      : null);
  const face = (p: CastMember, on: boolean, grow = false) => (
    <>
      <span
        className={`lanechip${p.lane ? ` bg-lane-${p.lane}` : ' lanechip--unknown'}`}
        style={{ width: 19, height: 19, border: 'none', ...(p.soft ? { background: p.soft, color: p.fg } : null) }}
      >
        {p.initial}
      </span>
      <span style={{ ...(grow ? { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } : null), fontSize: 12.5, fontWeight: 500, color: on ? 'var(--ink-96)' : 'var(--ink-62)', whiteSpace: 'nowrap' }}>{p.name}</span>
      {marks(p, on)}
    </>
  );
  const chip = (p: CastMember, live: boolean) => {
    const on = sel != null && p.key === sel.key;
    return (
      <button
        type="button"
        key={p.key}
        aria-selected={live ? on : undefined}
        tabIndex={live ? undefined : -1}
        onClick={live ? () => onSelect(p.key) : undefined}
        title={p.name}
        style={{ flex: 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 7, minHeight: 34, padding: '5px 11px', borderRadius: 9, font: 'inherit', background: on ? 'var(--brand-tint)' : 'var(--fill-05)', border: `1px solid ${on ? 'var(--brand-line)' : 'transparent'}`, cursor: 'pointer' }}
      >
        {face(p, on)}
      </button>
    );
  };
  const wrapStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
  return (
    <div ref={box} style={{ position: 'relative', padding: '0 2px 9px', margin: '0 -2px' }}>
      <div ref={measure} aria-hidden={drop || undefined} style={drop ? { ...wrapStyle, position: 'absolute', left: 2, right: 2, top: 0, visibility: 'hidden', pointerEvents: 'none' } : wrapStyle}>
        {roster.map((p) => chip(p, !drop))}
      </div>
      {drop && (
        <>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 7, minHeight: 38, padding: '6px 12px 6px 11px', borderRadius: 9, font: 'inherit', textAlign: 'left', background: 'var(--brand-tint)', border: '1px solid var(--brand-line)', cursor: 'pointer' }}
          >
            {face(sel ?? roster[0], sel != null, true)}
            <span style={{ flex: 1 }} />
            <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 400, color: 'var(--ink-45)', fontVariantNumeric: 'tabular-nums' }}>{`${roster.length} speakers`}</span>
            <Icon d={D.chevronDown} size={13} sw={2.2} style={{ flex: 'none', color: 'var(--ink-55)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .18s ease' }} />
          </button>
          {open && (
            <div role="listbox" aria-label="Speakers" style={{ position: 'absolute', left: 2, right: 2, top: 'calc(100% - 4px)', zIndex: 20, maxHeight: 320, overflowY: 'auto', padding: 5, borderRadius: 11, background: 'var(--vs-surface-raised, #1b1e2e)', border: '1px solid var(--vs-border)', boxShadow: '0 12px 32px rgba(5,6,21,.45)' }}>
              {roster.map((p) => {
                const on = sel != null && p.key === sel.key;
                return (
                  <button
                    type="button"
                    role="option"
                    key={p.key}
                    aria-selected={on}
                    onClick={() => { setOpen(false); onSelect(p.key); }}
                    title={p.name}
                    style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '6px 9px', borderRadius: 8, border: 0, font: 'inherit', textAlign: 'left', background: on ? 'var(--brand-tint)' : 'transparent', cursor: 'pointer' }}
                  >
                    {face(p, on, true)}
                    <span style={{ flex: 1 }} />
                    <span style={{ flex: 'none', width: 16, display: 'flex', justifyContent: 'flex-end' }}>{on && <Icon d={D.check} size={15} sw={2.2} style={{ color: 'var(--brand)' }} />}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}


export function VoiceSheetBody({ cast, voices, sampleId = null, dlId = null, onPick, note = null, t }: {
  cast?: ReactNode;
  voices: AvailableVoice[];
  sampleId?: string | null;
  dlId?: string | null;
  note?: { title: string; sub: string } | null;
  onPick: (v: AvailableVoice) => void;
  t: Strings;
}) {
  const rows = useMemo(() => voiceGroups(voices.filter((v) => v.cloned), t), [voices, t]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {cast}
      {note && (
        <>
          <div aria-hidden="true" style={{ height: 14 }} />
          <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 8px', margin: '0 -6px', borderRadius: 10, cursor: 'default' }}>
            <span style={{ flex: 'none', width: 32, height: 32, boxSizing: 'border-box', borderRadius: '50%', border: '1.5px dashed var(--fill-20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon d={D.mic} size={15} sw={1.6} style={{ color: 'var(--ink-45)' }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 400, color: 'var(--ink-62)', lineHeight: 1.3, overflowWrap: 'anywhere', textWrap: 'pretty' } as React.CSSProperties}>{note.title}</div>
              <div style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.4, color: 'var(--ink-62)', marginTop: 2, overflowWrap: 'anywhere', textWrap: 'pretty' } as React.CSSProperties}>{note.sub}</div>
            </div>
          </div>
        </>
      )}
      {rows.map(({ v, headOn, head, rule }) => {
        const detail = voiceDetail(v);
        const dling = dlId === v.id;
        const hearing = sampleId === v.id;
        return (
        <Fragment key={v.id}>
          {headOn && head === t.vcSheet && (
            <div aria-hidden="true" style={{ height: 14 }} />
          )}
          {headOn && head === t.vcSheet && (
            <div className="vchead"><span>{v.name}{' has a cloned voice'}</span></div>
          )}
          <button
            type="button"
            className="vcrow"
            aria-pressed={hearing}
            aria-label={[`Hear ${v.name}`, detail].filter(Boolean).join(', ')}
            onClick={() => onPick(v)}
            style={{ width: 'calc(100% + 12px)', textAlign: 'left', font: 'inherit', border: 0, borderTop: rule, display: 'flex', alignItems: 'center', gap: 11, padding: '7px 8px', margin: '0 -6px', borderRadius: 10, cursor: 'pointer', overflow: 'hidden' }}
          >
            <span title={dling ? 'Downloading this voice' : undefined} style={{ flex: 'none', boxSizing: 'border-box', width: 32, height: 32, borderRadius: '50%', border: dling ? 0 : '1.5px solid var(--brand)', background: dling ? 'transparent' : 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {dling
                ? <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--fill-10)', borderTopColor: 'var(--brand)', animation: 'vs-spin .7s linear infinite' }} />
                : hearing
                  ? <Equaliser height={11} width={2} />
                  : <PlayGlyph size={12} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={{ minWidth: 0, fontSize: 14.5, fontWeight: 500, lineHeight: 1.3, color: 'var(--ink-96)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
              </div>
              {detail && <div style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.4, color: 'var(--ink-62)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</div>}
            </div>
          </button>
        </Fragment>
        );
      })}
    </div>
  );
}

export function Equaliser({ height, width = 2 }: { height: number; width?: number }) {
  const bar = { width, height: '100%', borderRadius: 1, background: 'var(--brand)' } as const;
  return (
    <span style={{ flex: 'none', display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      <span style={{ ...bar, animation: 'vs-eq .62s ease-in-out infinite' }} />
      <span style={{ ...bar, animation: 'vs-eq .62s ease-in-out .2s infinite' }} />
      <span style={{ ...bar, animation: 'vs-eq .62s ease-in-out .38s infinite' }} />
    </span>
  );
}

const ORIGINAL_FLAG = (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
    <Icon d={D.langAuto} size={19} sw={1.7} style={{ color: 'var(--ink-62)', display: 'block' }} />
    <Icon d={D.globe} size={18} sw={1.6} style={{ color: 'var(--ink-62)', display: 'block' }} />
  </span>
);

export function langMeta(langs: LanguageLists | null, code: string | null) {
  const l = code ? langs?.languages.find((x) => x.code === code) : null;
  return { flag: code ? (l?.flag ?? '\u{1F310}') : ORIGINAL_FLAG, code: code ? code.toUpperCase() : '', label: l?.native ?? 'Original', name: l?.name ?? 'Original' };
}

export const PLAIN_CHIP: React.CSSProperties = { background: 'transparent', minHeight: 38, height: 38, width: 'auto' };

export const BAR_CHIP: React.CSSProperties = { minHeight: 36, height: 36, padding: '0 11px', background: 'var(--fill-06)' };

export function useVoiceCatalogue(
  lang: string | null,
  active: boolean,
  version: number = 0,
  tx?: { id: string | null; token?: string | null; shareCode?: string | null },
) {
  const txId = tx?.id ?? null;
  const txToken = tx?.token ?? null;
  const txShare = tx?.shareCode ?? null;
  const api = usePlayerApi();
  const { data } = useAsync(async () => {
    if (!lang || !active) return null;
    try {
      return (await api.client.voices.available(lang, { transcription: txId ?? undefined, shareCode: txId ? txShare ?? undefined : undefined, asOwner: api.owner })) as unknown as { voices: AvailableVoice[] };
    } catch {
      return null;
    }
  }, [lang, active, version, txId, txToken, txShare]);
  return data;
}

export function namedCount(model: Model): number {
  return new Set([...Object.keys(model.speakers), ...Object.keys(model.speakerIds)]).size;
}


type VoiceList = { transcriptionId: string; lang: string; rows: VoiceTrackRow[] };
const VOICE_LISTS = new Map<string, VoiceList>();
function rememberVoiceList(v: VoiceList) {
  const k = `${v.transcriptionId}|${v.lang}`;
  VOICE_LISTS.delete(k);
  VOICE_LISTS.set(k, v);
  while (VOICE_LISTS.size > 24) VOICE_LISTS.delete(VOICE_LISTS.keys().next().value!);
}

export function useArchiveVoice({ transcriptionId, lang, ended, cred, pickedVoice, sentenceIds, consent = true }: {
  consent?: boolean;
  transcriptionId: string | null;
  lang: string | null;
  ended: boolean;
  cred: MediaCred;
  pickedVoice: string | null;
  sentenceIds?: number[];
}) {
  const api = usePlayerApi();
  const { data: fetched, reload } = useAsync(async () => {
    if (!transcriptionId || !lang) return null;
    const got = (await api.client.transcriptions.voice(transcriptionId, lang, api.readAs).catch(() => [])) as unknown as VoiceTrackRow[];
    const v = { transcriptionId, lang, rows: got.filter((x) => x.lang === lang) };
    rememberVoiceList(v);
    return v;
  }, [transcriptionId, lang, api, ended]);
  const listed = fetched && fetched.lang === lang && fetched.transcriptionId === transcriptionId ? fetched : transcriptionId && lang ? VOICE_LISTS.get(`${transcriptionId}|${lang}`) ?? null : null;
  const rows = useMemo(
    () => (listed && listed.lang === lang && listed.transcriptionId === transcriptionId ? listed.rows : []),
    [listed, lang, transcriptionId],
  );
  const synthetic = !!parseCast(pickedVoice);
  const track = useMemo(() => trackFor(rows, synthetic ? 'synthetic' : 'cloned', pickedVoice), [rows, pickedVoice, synthetic]);
  const renderVoiceId = track ? track.voiceKey || null : pickedVoice;
  const [asking, setAsking] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const asked = useRef(new Set<string>());
  const renderKey = `${transcriptionId ?? ''}|${lang ?? ''}|${renderVoiceId ?? ''}`;
  const renderRef = useRef(renderVoiceId);
  renderRef.current = renderVoiceId;
  const requestRender = useCallback(async (voiceId: string | null, cast?: Map<number, string> | null) => {
    if (!transcriptionId || !lang || !ended) return;
    const stock = !!cast?.size || !!parseCast(voiceId);
    const k = `${transcriptionId}|${lang}|${renderRef.current ?? ''}`;
    if (asked.current.has(k)) return;
    asked.current.add(k);
    setAsking(k);
    setRenderError(null);
    const body: { langs: string[]; voices?: 'synthetic'; consent?: boolean } = stock ? { langs: [lang], voices: 'synthetic' } : { langs: [lang], consent };
    const r = await apiFetch(api, `/v1/transcriptions/${transcriptionId}/voice`, { method: 'POST', body }).catch(() => null);
    setAsking((a) => (a === k ? null : a));
    if (!r?.ok) {
      asked.current.delete(k);
      const e = r ? await r.json().catch(() => null) : null;
      setRenderError((e?.message as string) || 'This voice could not be prepared.');
      return;
    }
    reload();
  }, [transcriptionId, lang, ended, api, reload, consent]);
  const forget = useCallback(() => {
    const prefix = `${transcriptionId ?? ''}|${lang ?? ''}|`;
    for (const k of [...asked.current]) if (k.startsWith(prefix)) asked.current.delete(k);
    setRenderError(null);
  }, [transcriptionId, lang]);
  const rendering = (!!track && (track.state === 'queued' || track.state === 'running')) || asking === renderKey;
  const failed = track?.state === 'failed' ? track.error || 'the render failed' : renderError;
  const sentenceKey = sentenceIds?.join(',') ?? '';
  const [near, setNear] = useState<number | null>(null);
  const made = useMemo(() => new Set(track?.clips ?? []), [track]);
  const original = track?.original;
  const missing = useMemo(() => (ended && sentenceKey ? missingClips(sentenceKey.split(',').map(Number), made, original) : []), [ended, sentenceKey, made, original]);
  const kicked = useRef<{ key: string; near: number; at: number } | null>(null);
  useEffect(() => {
    if (!ended || !transcriptionId || !lang || !missing.length) return;
    const at = near ?? missing[0];
    const target = missing.find((id) => id >= at) ?? missing[0];
    const key = `${transcriptionId}|${lang}|${renderVoiceId ?? ''}`;
    const prev = kicked.current;
    if (prev && prev.key === key && Math.abs(prev.near - target) < 12 && Date.now() - prev.at < 60_000) return;
    kicked.current = { key, near: target, at: Date.now() };
    const body: { langs: string[]; near: number; voices?: 'synthetic'; consent?: boolean } = synthetic ? { langs: [lang], near: target, voices: 'synthetic' } : { langs: [lang], near: target, consent };
    void apiFetch(api, `/v1/transcriptions/${transcriptionId}/voice`, { method: 'POST', body })
      .then((r) => { if (!r.ok) kicked.current = null; })
      .catch(() => { kicked.current = null; });
  }, [ended, transcriptionId, lang, renderVoiceId, near, missing, api, consent, synthetic]);
  const missingNow = missing.length > 0;
  const lastCount = useRef({ n: -1, at: 0 });
  useEffect(() => {
    if (!missingNow) return;
    const t = setInterval(() => {
      const n = made.size;
      if (n !== lastCount.current.n) lastCount.current = { n, at: Date.now() };
      if (Date.now() - lastCount.current.at > 10 * 60_000) return;
      reload();
    }, 3000);
    return () => clearInterval(t);
  }, [missingNow, reload, made]);
  const clips = useMemo(() => {
    if (!transcriptionId) return [];
    const ids = sentenceKey ? sentenceKey.split(',').map(Number).filter((id) => !ended || made.has(id)) : undefined;
    const row = track ?? (ids?.length && lang
      ? { lang, voiceKey: pickedVoice ?? '', state: 'clips', clips: [], voice: null } as VoiceTrackRow
      : null);
    return archiveClips(row, transcriptionId, api.origin, cred, ids);
  }, [track, transcriptionId, api, cred, sentenceKey, lang, pickedVoice, ended, made]);
  const coming = useMemo(() => new Set(missing), [missing]);
  return { listed, rows, track, renderVoiceId, rendering, failed, clips, requestRender, forget, reload, setNear, missing: missing.length, coming, original: original ?? null };
}

export interface TabSpec<K extends string> { key: K; label: string; icon?: string; sw?: number }
export function HeadTap({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  const lead = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = lead.current, head = el?.parentElement;
    if (!el || !head) return;
    const ro = new ResizeObserver(() => fit());
    const watched = new Set<Element>();
    const sideCol = () => {
      for (let a: HTMLElement | null = head.parentElement; a; a = a.parentElement) {
        const c = [...a.querySelectorAll<HTMLElement>('[data-tab-col]')].find((x) => x.offsetWidth > 0);
        if (c) return c;
      }
      return null;
    };
    const fit = () => {
      const pins = [...head.querySelectorAll<HTMLElement>('.dhead__clock--pin, .dhead__lib')];
      const col = pins.length ? sideCol() : null;
      if (col && !watched.has(col)) { watched.add(col); ro.observe(col); }
      const right = col ? `${Math.round(head.getBoundingClientRect().right - col.getBoundingClientRect().left + 20)}px` : '';
      pins.forEach((p) => { if (p.style.right !== right) p.style.right = right; });
      const left = Math.min(...pins.map((p) => p.getBoundingClientRect().left));
      const mw = pins.length ? `${Math.max(160, Math.floor(left - el.getBoundingClientRect().left - 16))}px` : '';
      if (el.style.maxWidth !== mw) el.style.maxWidth = mw;
    };
    fit();
    ro.observe(head);
    const mo = new MutationObserver(fit);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    mo.observe(head, { childList: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);
  return (
    <div className="dhead__lead" ref={lead}>
      <div className="dhead__tap" role="button" tabIndex={0} title="Back" aria-label="Back" onClick={(e) => { e.currentTarget.blur(); onBack(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBack(); } }}>
        <span className="dhead__back" aria-hidden="true"><Icon d={D.chevronLeft} size={19} sw={1.7} /></span>
        {children}
      </div>
    </div>
  );
}

const TAB_ICON: Record<string, string> = { share: D.share, delay: D.tabGauge, video: D.video, source: D.tabSources, script: D.tabScript, fix: D.tabFix, ending: D.tabEnding, summary: D.tabSummary, export: D.tabExport, settings: D.tabSettings, sources: D.tabSources, recs: D.mic };

export function TabBar<K extends string>({ tabs, current, onPick, gap, fold = true, side = !fold }: { tabs: TabSpec<K>[]; current: K | 'none'; onPick: (k: K | 'none') => void; side?: boolean; gap?: boolean; fold?: boolean }) {
  const few = fold && tabs.length <= 3;
  const anyOn = tabs.some((t) => t.key === current);
  const [tip, setTip] = useState<{ k: K; label: string; x: number; y: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipW, setTipW] = useState(0);
  useEffect(() => { if (tipRef.current) setTipW(tipRef.current.offsetWidth); }, [tip?.k]);
  const showTip = (e: React.MouseEvent<HTMLElement>, t: TabSpec<K>) => {
    const l = e.currentTarget.querySelector<HTMLElement>('.tabbar__label');
    if (few || fold || t.key === current || (l && getComputedStyle(l).opacity === '1')) { if (tip) setTip(null); return; }
    if (tip?.k === t.key) return;
    const tab = e.currentTarget.getBoundingClientRect();
    const strip = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    setTip({ k: t.key, label: t.label, x: tab.left + tab.width / 2, y: strip.top });
  };
  const hideTip = () => setTip(null);
  let tipEl: ReactNode = null;
  if (tip) {
    const strip = { l: 0, r: typeof window !== 'undefined' ? window.innerWidth : 0 };
    const w = tipW || 80;
    const left = Math.max(strip.l + 8, Math.min(strip.r - w - 8, tip.x - w / 2));
    tipEl = createPortal(
      <div className="vsp vsp-portal" data-theme="dark"><div ref={tipRef} data-theme="dark" className="vs-tip__bubble vs-tip__bubble--top tabtip" style={{ position: 'fixed', left, top: tip.y - 8, bottom: 'auto', width: 'auto', whiteSpace: 'nowrap', transform: 'translateY(-100%)', zIndex: 2147483000, pointerEvents: 'none' }}>
        <span className="vs-tip__row"><span className="vs-tip__copy">{tip.label}</span></span>
        <span className="vs-tip__arrow" style={{ left: Math.round(Math.max(8, Math.min(w - 19, tip.x - left - 5.5))) }} />
      </div></div>,
      document.body,
    );
  }
  return (
    <div role="tablist" className={`tabbar tabbar--icons${fold ? '' : ' tabbar--desk'}`} data-desk-tabs={side ? '' : undefined} data-tab-n={side ? tabs.length : undefined} style={{ marginBottom: gap ? 12 : 0 }} onMouseLeave={hideTip}>
      {tabs.map((t) => {
        const on = current === t.key;
        const labelled = few || on;
        const flex = few ? '1 1 0' : on ? '1 1 auto' : fold && !anyOn ? '1 1 0' : '0 0 auto';
        const icon = t.icon ?? TAB_ICON[t.key];
        const pick = () => { hideTip(); onPick(fold && on ? 'none' : t.key); };
        return fold ? (
          <button key={t.key} type="button" role="tab" aria-selected={on} title={t.label} className={`tabbar__tab${on ? ' is-on' : ''}`} style={{ flex }} onClick={pick}>
            {icon && <Icon d={icon} size={15} sw={t.sw ?? 2} style={{ flex: 'none' }} />}
            {labelled && <span className="tabbar__label">{t.label}</span>}
          </button>
        ) : (
          <div key={t.key} className="tabbar__slot" data-tab-cell="" style={{ flex }} onMouseEnter={(e) => showTip(e, t)} onMouseMove={(e) => showTip(e, t)} onClick={pick}>
            <button type="button" role="tab" aria-selected={on} aria-label={t.label} className={`tabbar__tab${on ? ' is-on' : ''}${tip?.k === t.key ? ' is-tip' : ''}`}>
              {icon && <Icon d={icon} size={15} sw={t.sw ?? 2} className="tabbar__icon" style={{ flex: 'none', transform: on && !few ? 'scale(1.12)' : 'none' }} />}
              <span className="tabbar__grow" data-tab-lw="" style={{ gridTemplateColumns: labelled ? '1fr' : '0fr', marginLeft: labelled && icon ? 6 : 0 }}>
                <span className="tabbar__label" data-tab-l="" style={{ opacity: labelled ? 1 : 0, transform: labelled ? 'none' : 'translateX(-6px)' }}>{t.label}</span>
              </span>
            </button>
          </div>
        );
      })}
      {tipEl}
    </div>
  );
}

const DL_D = 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3';
const AUDIO_D = 'M3.75 10.5v3M7.5 7.5v9M11.25 4.5v15M15 8.25v7.5M18.75 6v12M22.5 10.5v3';

type Download = { name: string; meta: string; icon?: ReactNode; onClick: () => void | Promise<unknown> };

export function ExportPanel({ audio, video, formats, onExport }: { audio?: Download | null; video?: Download | null; formats?: boolean; onExport: (k: ExportFormat) => void | Promise<unknown> }) {
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(timer.current); }; }, []);
  const flash = (k: string) => { window.clearTimeout(timer.current); setDone(k); timer.current = window.setTimeout(() => setDone(null), 1600); };
  const exportAs = (k: ExportFormat) => {
    if (busy) return;
    setBusy(k);
    Promise.resolve()
      .then(() => onExport(k))
      .then(() => { if (alive.current) flash(k); })
      .catch(() => { })
      .finally(() => { if (alive.current) setBusy(null); });
  };
  const save = (k: 'audio' | 'video', dl: Download) => {
    if (busy) return;
    setBusy(k);
    Promise.resolve()
      .then(() => dl.onClick())
      .then(() => { if (alive.current) flash(k); })
      .catch(() => { })
      .finally(() => { if (alive.current) setBusy(null); });
  };
  const row = (k: 'audio' | 'video', dl: Download, icon: string, label: string) => (
    <>
      <Eyebrow style={{ letterSpacing: '.12em', color: 'var(--ink-35)' }}>{label}</Eyebrow>
      <button type="button" className="dlrow" disabled={busy != null} aria-busy={busy === k || undefined} onClick={() => save(k, dl)} style={busy && busy !== k ? { opacity: 0.45 } : undefined}>
        <span style={{ display: 'inline-flex', flex: 'none', color: 'var(--ink-70)' }}>{dl.icon ?? <Icon d={icon} size={17} sw={1.5} />}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-96)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dl.name}</span>
          <span style={{ font: '500 9.5px var(--vs-font-mono)', color: 'var(--ink-40)', letterSpacing: '.04em' }}>{dl.meta}</span>
        </span>
        {busy === k
          ? <Spinner size={17} color="var(--brand)" track="var(--fill-12)" />
          : <Icon d={done === k ? D.check : DL_D} size={17} sw={1.6} style={{ flex: 'none', color: done === k ? 'var(--brand)' : 'var(--ink-62)' }} />}
      </button>
    </>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {audio && row('audio', audio, AUDIO_D, 'DOWNLOAD AUDIO')}
      {video && row('video', video, D.video, 'DOWNLOAD VIDEO')}
      {formats !== false && (
        <>
          <Eyebrow style={{ letterSpacing: '.12em', color: 'var(--ink-35)' }}>EXPORT AS</Eyebrow>
          <div className="fmtgrid">
            {TX_FORMATS.map((f) => (
              <button key={f.key} type="button" className="fmtgrid__cell" title={busy === f.key ? `Building the ${f.name}…` : f.note} disabled={busy != null} aria-busy={busy === f.key || undefined} onClick={() => exportAs(f.key)} style={busy && busy !== f.key ? { opacity: 0.45 } : undefined}>
                {busy === f.key
                  ? <Spinner size={16} color="var(--brand)" track="var(--fill-12)" />
                  : <Icon d={done === f.key ? D.check : f.icon} size={16} sw={1.6} style={{ color: done === f.key ? 'var(--brand)' : 'var(--ink-62)' }} />}
                <span>{f.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}



export function shareLink(url: string, title: string, onCopied?: () => void) {
  const copy = () => { void navigator.clipboard?.writeText(url).then(() => onCopied?.(), () => {}); };
  if (navigator.share) { navigator.share({ title, url }).catch((e) => { if (!e || (e as Error).name !== 'AbortError') copy(); }); return; }
  copy();
}


export type SummaryState = {
  state: 'idle' | 'pending' | 'ready' | 'unavailable' | 'not_requested';
  request?: () => void;
  title?: string;
  summary?: string;
  slow?: boolean;
  retry: () => void;
};

const SUMMARY_POLL_MS = 4000;
const SUMMARY_REASK_MS = 60_000;
const SUMMARY_SLOW_MS = 180_000;

export function useSummaryIn(base: SummaryState, transcriptionId: string | null, lang: string | null): SummaryState {
  const [got, setGot] = useState<{ key: string; s: SummaryState } | null>(null);
  const ready = base.state === 'ready';
  const key = `${transcriptionId ?? ''}|${lang ?? ''}|${ready ? `${base.title}\n${base.summary}` : ''}`;
  const api = usePlayerApi();
  useEffect(() => {
    if (!transcriptionId || !lang || !ready) return;
    let alive = true;
    api.client.transcriptions.summary(transcriptionId, { lang, ...api.readAs })
      .then((r) => r as unknown as { state: string; title?: string; summary?: string })
      .then((r) => {
        if (!alive) return;
        const s: SummaryState = r?.state === 'ready' && r.title && r.summary ? { state: 'ready', title: r.title, summary: r.summary, retry: base.retry } : base;
        setGot({ key, s });
      })
      .catch(() => { if (alive) setGot({ key, s: base }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, api]);
  if (!lang || !ready) return base;
  if (got?.key === key) return got.s;
  return { state: 'pending', retry: base.retry };
}

export function summaryOf(rec: { title?: string | null; summary?: string | null } | null | undefined): SummaryState {
  return rec?.title && rec?.summary ? { state: 'ready', title: rec.title, summary: rec.summary, retry: () => {} } : { state: 'unavailable', retry: () => {} };
}

export function SummaryPanel({ s }: { s: SummaryState }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const title = s.title ?? '';
  const body = s.summary ?? '';
  const copy = () => {
    void navigator.clipboard?.writeText(`${title}\n\n${body}`).catch(() => {});
    window.clearTimeout(timer.current);
    setCopied(true);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  const note = (text: string, action?: { label: string; onClick: () => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 300, lineHeight: 1.45, color: 'var(--ink-45)' }}>
      <span style={{ flex: 1 }}>{text}</span>
      {action && <button type="button" className="txlinks__manage" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 }}>
        <Eyebrow style={{ letterSpacing: '.12em', color: 'var(--ink-35)' }}>SUMMARY</Eyebrow>
        {s.state === 'ready' && (
          <button type="button" className="sumcopy" title="Copy title and summary" style={{ color: copied ? 'var(--brand)' : 'var(--ink-70)' }} onClick={copy}>
            <Icon d={copied ? D.check : COPY_D} size={13} sw={1.6} />{copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {s.state === 'ready' ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-.15px', color: 'var(--ink-96)', textWrap: 'pretty' } as React.CSSProperties}>{title}</div>
          <div style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.55, color: 'var(--ink-80)', textWrap: 'pretty', whiteSpace: 'pre-line' } as React.CSSProperties}>{body}</div>
        </>
      ) : s.state === 'unavailable' ? (
        note('No summary for this transcription.')
      ) : s.state === 'not_requested' ? (
        s.request ? note('This transcription was made without a summary.', { label: 'Summarize', onClick: s.request }) : note('Recordings under a minute and files of a batch are not summarised.')
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 300, color: 'var(--ink-45)' }}>
          <Spinner size={14} color="var(--brand)" track="var(--fill-12)" />{s.slow ? 'Still writing the summary…' : 'Writing the summary…'}
        </div>
      )}
    </div>
  );
}

export function LiveVideo({ ytId, title, timeLabel, radius, style, large, children, picture }: { ytId: string; title: string; timeLabel?: string | null; radius?: number; style?: React.CSSProperties; large?: boolean; children?: React.ReactNode; picture?: React.ReactNode }) {
  return (
    <div className="livevid" style={{ ...(radius != null ? { borderRadius: radius } : null), ...style }}>
      <Icon d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" size={large ? 34 : 30} sw={1.2} />
      {picture ?? <iframe src={liveEmbedUrl(ytId)} title={title} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" />}
      {timeLabel && <span className="livevid__t" style={large ? { bottom: 10, right: 10 } : undefined}>{timeLabel}</span>}
      {children}
    </div>
  );
}



export function useDragScroll(enabled = true, external?: React.RefObject<HTMLDivElement>) {
  const own = useRef<HTMLDivElement | null>(null);
  const ref = (external ?? own) as React.MutableRefObject<HTMLDivElement | null>;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startY = 0, startTop = 0, dragging = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button,a,input,textarea,select')) return;
      dragging = true;
      startY = e.clientY;
      startTop = el.scrollTop;
      el.classList.add('is-dragging');
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 2) el.setPointerCapture?.(e.pointerId);
      el.scrollTop = startTop - dy;
    };
    const up = () => { dragging = false; el.classList.remove('is-dragging'); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [enabled]);
  return ref;
}

const COPY_D = 'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75';
