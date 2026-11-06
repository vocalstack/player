import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconButton, Sheet } from '../ds/Controls';
import type { Strings } from '../data/i18n';
import { D, Icon, Logo, Mark, PauseGlyph, PlayGlyph, SITE } from '../ds/Icons';
import { qrSvgUrl } from '../core/qr';
import { shareLink } from './shared';
import { clock } from '../core/format';

const HINT_CODES = ['es', 'fr', 'ro', 'ja', 'pt'];

const DUCK = 0.5;

const ICON_FULL = 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15';
const ICON_EXIT = 'M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25';

let pseudoEl: HTMLElement | null = null;
let pseudoWas: (readonly [string, string, string, string])[] = [];
let pseudoMeta: (() => void) | null = null;
const PSEUDO_EVENT = 'vsp-pseudofullchange';

function fullNow(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element };
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? pseudoEl;
}

let fullTarget: HTMLElement | null = null;
export function setFullTarget(el: HTMLElement | null) {
  if (!el && pseudoEl && pseudoEl === fullTarget) pseudoFull(false);
  fullTarget = el;
}

function nativeFull(): boolean {
  const d = document as Document & { webkitFullscreenEnabled?: boolean };
  const el = (fullTarget ?? document.documentElement) as HTMLElement & { webkitRequestFullscreen?: unknown };
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled) && !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

function canFull(): boolean {
  return nativeFull() || !!fullTarget;
}

function blackChrome(): () => void {
  const undo: (() => void)[] = [];
  const tints = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  tints.forEach((m) => { const was = m.content; m.content = '#000'; undo.push(() => { m.content = was; }); });
  if (!tints.some((m) => !m.media)) {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = '#000';
    document.head.appendChild(m);
    undo.push(() => m.remove());
  }
  const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (vp && !/viewport-fit\s*=\s*cover/i.test(vp.content)) {
    const was = vp.content;
    const rest = was.split(',').map((x) => x.trim()).filter((x) => x && !/^viewport-fit\s*=/i.test(x));
    vp.content = [...rest, 'viewport-fit=cover'].join(', ');
    undo.push(() => { vp.content = was; });
  }
  return () => undo.reverse().forEach((f) => f());
}

let pseudoRoom: (() => void) | null = null;
let pseudoY = 0;

function swipeRoom(el: HTMLElement, y0: number): () => void {
  const html = document.documentElement;
  pseudoY = y0;
  const was = html.style.overscrollBehavior;
  const strip = document.createElement('div');
  strip.setAttribute('aria-hidden', 'true');
  strip.style.cssText = `position:absolute;top:0;left:0;width:1px;height:calc(${Math.round(y0)}px + 100lvh + 240px);pointer-events:none;visibility:hidden`;
  document.body.appendChild(strip);
  html.style.overscrollBehavior = 'none';
  window.scrollTo(0, y0);
  const vv = window.visualViewport;
  const fit = () => {
    if (!vv) return;
    el.style.setProperty('--vsp-vvt', `${vv.offsetTop}px`);
    el.style.setProperty('--vsp-vvl', `${vv.offsetLeft}px`);
    el.style.setProperty('--vsp-vvw', `${vv.width}px`);
    el.style.setProperty('--vsp-vvh', `${vv.height}px`);
  };
  fit();
  if (vv) el.classList.add('vsp--vv');
  let raf = 0;
  const nudge = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { fit(); if (window.scrollY <= y0) window.scrollTo(0, y0 + 1); }); };
  vv?.addEventListener('resize', fit);
  vv?.addEventListener('scroll', fit);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', nudge);
  nudge();
  return () => {
    cancelAnimationFrame(raf);
    vv?.removeEventListener('resize', fit);
    vv?.removeEventListener('scroll', fit);
    window.removeEventListener('resize', fit);
    window.removeEventListener('orientationchange', nudge);
    el.classList.remove('vsp--vv');
    ['--vsp-vvt', '--vsp-vvl', '--vsp-vvw', '--vsp-vvh'].forEach((k) => el.style.removeProperty(k));
    strip.remove();
    html.style.overscrollBehavior = was;
    window.scrollTo(0, y0);
  };
}

function swipeable(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

function pseudoFull(on: boolean) {
  const els = [document.documentElement, document.body];
  if (on && !pseudoEl && fullTarget) {
    pseudoEl = fullTarget;
    const y0 = window.scrollY;
    pseudoWas = els.map((el) => [el.style.overflow, el.style.overscrollBehavior, el.style.getPropertyValue('background-color'), el.style.getPropertyPriority('background-color')] as const);
    const swipe = swipeable();
    els.forEach((el) => { if (!swipe) { el.style.overflow = 'hidden'; el.style.overscrollBehavior = 'none'; } el.style.setProperty('background-color', '#000', 'important'); });
    pseudoMeta = blackChrome();
    pseudoEl.classList.add('vsp--pseudofull');
    pseudoRoom = swipe ? swipeRoom(pseudoEl, y0) : null;
  } else if (!on && pseudoEl) {
    pseudoEl.classList.remove('vsp--pseudofull');
    els.forEach((el, i) => { el.style.overflow = pseudoWas[i]?.[0] ?? ''; el.style.overscrollBehavior = pseudoWas[i]?.[1] ?? ''; el.style.removeProperty('background-color'); if (pseudoWas[i]?.[2]) el.style.setProperty('background-color', pseudoWas[i][2], pseudoWas[i][3]); });
    pseudoMeta?.();
    pseudoMeta = null;
    pseudoRoom?.();
    pseudoRoom = null;
    pseudoEl = null;
  } else return;
  document.dispatchEvent(new Event(PSEUDO_EVENT));
}

function noBrowserFull(): boolean {
  if (typeof document === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches) return false;
  const el = (fullTarget ?? document.documentElement) as HTMLElement & { webkitRequestFullscreen?: unknown };
  return !el.requestFullscreen && !el.webkitRequestFullscreen;
}

export function browserFull(on: boolean) {
  if (typeof document === 'undefined') return;
  if (!on) pseudoFull(false);
  if (!window.matchMedia?.('(pointer: coarse)').matches || !nativeFull()) return;
  realFull(on);
}

export function realFull(on: boolean) {
  if (typeof document === 'undefined') return;
  if (!nativeFull() || pseudoEl) {
    pseudoFull(on);
    return;
  }
  const d = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
  const el = (fullTarget ?? document.documentElement) as HTMLElement & { webkitRequestFullscreen?: (o?: FullscreenOptions) => Promise<void> };
  const now = d.fullscreenElement ?? d.webkitFullscreenElement;
  try {
    if (on && !now) void (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch(() => {});
    if (!on && now) void (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d)?.catch(() => {});
  } catch { }
}

function useMedia(q: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const f = () => setOn(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
}

export type PlayerPos = { live: boolean; atEdge: boolean; edgeFrac: number | null; readyFrac?: number | null; pct: number; atLabel: string; labelAt: (frac: number) => string; endLabel: string; onSeek: (frac: number) => void };
export type VoicesBtn = { on: boolean; title: string; onClick: () => void; busy?: boolean };
export type PlayerTransport = { prevOn: boolean; nextOn: boolean; onPrev: () => void; onNext: () => void; playing: boolean; playable: boolean; playTitle: string; onPlay?: () => void; busy?: boolean };

function SeekRow({ pos, interactive, axis = 'x' }: { pos: PlayerPos; interactive: boolean; axis?: 'x' | 'y' }) {
  const [drag, setDrag] = useState<number | null>(null);
  const fracOf = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = axis === 'y' ? (e.clientY - r.top) / Math.max(1, r.height) : (e.clientX - r.left) / Math.max(1, r.width);
    return Math.min(1, Math.max(0, f));
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => { if (drag == null) return; const f = fracOf(e); setDrag(null); pos.onSeek(f); };
  const shown = drag != null ? drag * 100 : pos.pct;
  return (
    <>
      <span className={`gfull__t${interactive ? ' gfull__t--at' : ''}`}>{drag != null ? pos.labelAt(drag) : pos.atLabel}</span>
      <div className={`gfull__seek${interactive ? ' gfull__seek--on' : ''}`} role={interactive ? 'slider' : undefined} aria-label={interactive ? 'Playback position' : undefined} aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? 100 : undefined} aria-valuenow={interactive ? Math.round(shown) : undefined}
        onPointerDown={interactive ? (e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(fracOf(e)); e.preventDefault(); } : undefined}
        onPointerMove={interactive ? (e) => { if (drag != null) setDrag(fracOf(e)); } : undefined}
        onPointerUp={interactive ? up : undefined} onPointerCancel={interactive ? () => setDrag(null) : undefined}>
        <div className={`gfull__track${pos.readyFrac != null ? ' gfull__track--part' : ''}`}>
          {pos.readyFrac != null && <div className="gfull__ready" style={{ width: `${Math.min(100, pos.readyFrac * 100)}%` }} />}
          <div style={{ width: `${shown}%`, background: pos.live ? '#ec634d' : '#55abe5', transition: drag != null ? 'none' : undefined }} />
          <i style={{ left: `${shown}%`, transition: drag != null ? 'none' : undefined }} />
        </div>
      </div>
      {pos.live
        ? <button type="button" className={`gfull__liveb${pos.atEdge ? '' : ' gfull__liveb--behind'}`} title={pos.atEdge ? 'Live' : 'Go to live'} aria-label={pos.atEdge ? 'Live' : 'Go to live'} onClick={(e) => { e.stopPropagation(); if (!pos.atEdge) pos.onSeek(pos.edgeFrac ?? 1); }}><i />{pos.endLabel}</button>
        : <span className="gfull__t gfull__end" style={{ color: 'rgba(234,236,250,.6)' }}>{pos.endLabel}</span>}
    </>
  );
}

export function PanelSeek({ pos }: { pos: PlayerPos }) {
  const [drag, setDrag] = useState<number | null>(null);
  const fracOf = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => { if (drag == null) return; const f = fracOf(e); setDrag(null); pos.onSeek(f); };
  const shown = drag != null ? drag * 100 : pos.pct;
  const glide = drag != null ? 'none' : undefined;
  return (
    <div className="gaseek">
      <div className="gaseek__bar" role="slider" aria-label="Playback position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown)}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(fracOf(e)); e.preventDefault(); }}
        onPointerMove={(e) => { if (drag != null) setDrag(fracOf(e)); }}
        onPointerUp={up} onPointerCancel={() => setDrag(null)}>
        <div className="gaseek__track" />
        <div className="gaseek__fill" style={{ width: `${shown}%`, transition: glide }} />
        <i style={{ left: `${shown}%`, transition: glide }} />
      </div>
      <div className="gaseek__labels">
        <span className="gaseek__t">{drag != null ? pos.labelAt(drag) : pos.atLabel}</span>
        <span className="gaseek__t gaseek__end">{pos.endLabel}</span>
      </div>
    </div>
  );
}

function GlassTransport({ t, mini }: { t: PlayerTransport; mini?: boolean }) {
  return (
    <div className="gfull__transport">
      <button type="button" className="gfull__step" aria-label="Previous line" title="Previous line" style={{ opacity: t.prevOn ? 1 : 0.3 }} onClick={t.onPrev}><Icon d={D.chevronLeft} size={mini ? 13 : 16} sw={mini ? 1.8 : 1.9} /></button>
      <button type="button" className="gfull__play" aria-label={t.busy ? 'Preparing audio' : t.playing ? 'Pause' : 'Play'} title={t.playTitle} disabled={!t.playable}
        style={{ background: !t.playable ? 'rgba(5,6,21,.42)' : t.playing ? 'rgba(238,240,248,.92)' : 'var(--brand)', color: !t.playable ? 'rgba(234,236,250,.5)' : t.playing ? '#131326' : 'var(--brand-ink)', cursor: t.playable ? 'pointer' : 'default' }}
        onClick={t.onPlay}>{t.busy ? <span className="gfull__spin" aria-hidden="true" /> : t.playing ? <PauseGlyph size={mini ? 14 : 18} /> : <PlayGlyph size={mini ? 15 : 19} />}</button>
      <button type="button" className="gfull__step" aria-label="Next line" title="Next line" style={{ opacity: t.nextOn ? 1 : 0.3 }} onClick={t.onNext}><Icon d={D.chevronRight} size={mini ? 13 : 16} sw={mini ? 1.8 : 1.9} /></button>
    </div>
  );
}

function GlassBrand({ live, mini, desk, pct, mark }: { live: boolean; mini?: boolean; desk?: boolean; pct?: number | null; mark?: boolean }) {
  return <div className={`gfull__brand${mark ? ' gfull__brand--mark' : ''}`}><a href={SITE} target="_blank" rel="noopener" style={{ display: 'block', lineHeight: 0 }} aria-label="VocalStack" title="VocalStack">{mark ? <Mark dark size={22} /> : <Logo dark link={false} height={mini ? 11 : desk ? 18 : 15} />}</a>{pct != null && <span className="gfull__txpct" title="Still being transcribed: it plays as far as it is written">{`TRANSCRIBING ${pct}%`}</span>}</div>;
}

function VoicesButton({ v, size }: { v: VoicesBtn; size: number }) {
  return <button type="button" className="gfull__btn" aria-label="Voices" aria-busy={v.busy || undefined} title={v.busy ? 'Preparing the voice…' : v.title} disabled={!v.on} style={{ position: 'relative', opacity: v.on || v.busy ? 1 : 0.45, cursor: v.on ? 'pointer' : 'default' }} onClick={v.on ? v.onClick : undefined}><Icon d={D.headphones} size={size} sw={1.6} />{v.busy && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', borderRadius: '50%', border: '2px solid var(--fill-12)', borderTopColor: 'var(--brand)', animation: 'vs-spin .7s linear infinite', pointerEvents: 'none' }} />}</button>;
}

export function MiniPlayer({ pos, transport, chip, voices, onShare, onFull, copied }: { pos: PlayerPos; transport: PlayerTransport; chip: React.ReactNode; voices: VoicesBtn; onShare?: () => void; onFull: () => void; copied: React.ReactNode }) {
  return (
    <div className="gmini" data-theme="dark">
      <div className="gmini__shade" aria-hidden="true" />
      <div className="gmini__top"><GlassBrand live={pos.live} mini /></div>
      <div className="gmini__foot">
        <div className="gmini__row"><SeekRow pos={pos} interactive /></div>
        <div className="gmini__row gmini__row--ctl">
          <GlassTransport t={transport} mini />
          <span style={{ flex: 1 }} />
          <div className="gfull__chip">{chip}</div>
          <VoicesButton v={voices} size={14} />
          {onShare && <button type="button" className="gfull__btn" aria-label="Share" title="Share" onClick={(e) => { e.stopPropagation(); onShare(); }}><Icon d={D.share} size={13} sw={1.8} /></button>}
          <button type="button" className="gfull__btn" aria-label="Full screen" title="Full screen" onClick={onFull}><Icon d={ICON_FULL} size={14} sw={1.8} /></button>
        </div>
      </div>
      {copied}
    </div>
  );
}

const DIM_WORD: React.CSSProperties = { color: 'rgba(255,255,255,.4)' };

export function FullVideo({ topLeft, modal, compact = false, noFull = false, page = true, picture, title, desk, pos, sub, wait, pct, mute, cc, ad, chip, transport, picker, sheet, voices, voicesBtn, sheetOpen, onShare, onSettings, paused, copied, onTouch, onClose }: { topLeft?: React.ReactNode; modal?: React.ReactNode; compact?: boolean; noFull?: boolean; page?: boolean; onTouch: () => void; onSettings?: () => void; paused?: { title: string; summary: string | null; share?: { url: (t: number | null) => string; at: number } | null } | null; voices: React.ReactNode; voicesBtn: VoicesBtn | null; picture: React.ReactNode; title: string; desk: boolean; pos: PlayerPos; sub: { who: string | null; color: string; words: { t: string; sp: string; dim: boolean }[]; cursor?: number | null } | null; wait?: React.ReactNode; pct?: number | null; mute?: { muted: boolean; onToggle: () => void }; cc?: { on: boolean; onToggle: () => void }; ad?: boolean; chip: React.ReactNode; transport: PlayerTransport; picker: React.ReactNode; sheet: React.ReactNode; sheetOpen: boolean; onShare?: () => void; copied: React.ReactNode; onClose?: () => void }) {
  const [isFull, setIsFull] = useState(() => !!fullNow());
  useEffect(() => {
    const on = () => setIsFull(!!fullNow());
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    document.addEventListener(PSEUDO_EVENT, on);
    return () => { document.removeEventListener('fullscreenchange', on); document.removeEventListener('webkitfullscreenchange', on); document.removeEventListener(PSEUDO_EVENT, on); };
  }, []);
  const close = useRef(onClose);
  close.current = onClose;
  const play = useRef(transport.playable ? transport.onPlay : undefined);
  play.current = transport.playable ? transport.onPlay : undefined;
  const [calm, setCalm] = useState(false);
  const [touchN, setTouchN] = useState(0);
  const swallow = useRef(false);
  useEffect(() => () => realFull(false), []);
  useEffect(() => {
    if (!page) return;
    const els = [document.documentElement, document.body];
    const was = els.map((el) => el.style.background);
    els.forEach((el) => { el.style.background = '#050507'; });
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const tint = meta?.content;
    if (meta) meta.content = '#050507';
    return () => { els.forEach((el, i) => { el.style.background = was[i]; }); if (meta && tint) meta.content = tint; };
  }, []);
  const swipeFull = useMemo(() => page && noBrowserFull(), [page]);
  const [barsUp, setBarsUp] = useState(swipeFull);
  const [loud, setLoud] = useState(false);
  useEffect(() => { if (!barsUp) setLoud(false); }, [barsUp]);
  useEffect(() => {
    if (!page) return;
    const els = [document.documentElement, document.body];
    const was = els.map((el) => [el.style.overflow, el.style.overscrollBehavior] as const);
    if (!swipeFull) {
      els.forEach((el) => { el.style.overflow = 'hidden'; el.style.overscrollBehavior = 'none'; });
      return () => els.forEach((el, i) => { el.style.overflow = was[i][0]; el.style.overscrollBehavior = was[i][1]; });
    }
    const strip = document.createElement('div');
    strip.setAttribute('aria-hidden', 'true');
    strip.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:calc(100lvh + 160px);pointer-events:none';
    document.body.appendChild(strip);
    document.documentElement.style.overscrollBehavior = 'none';
    const onScroll = () => setBarsUp(window.scrollY <= 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      strip.remove();
      document.documentElement.style.overscrollBehavior = was[0][1];
      window.scrollTo(0, 0);
    };
  }, [swipeFull, page]);
  const pseudoSwipe = isFull && !!pseudoRoom && pseudoEl === fullTarget;
  const [pseudoBars, setPseudoBars] = useState(true);
  useEffect(() => {
    if (!pseudoSwipe) return;
    const vv = window.visualViewport;
    const check = () => {
      const short = Math.min(window.screen?.width || 0, window.screen?.height || 0);
      const side = window.innerWidth > window.innerHeight;
      setPseudoBars(window.scrollY <= pseudoY + 24 && !(side && short > 0 && (vv?.height ?? window.innerHeight) >= short - 2));
    };
    setPseudoBars(true);
    check();
    window.addEventListener('scroll', check, { passive: true });
    vv?.addEventListener('resize', check);
    return () => { window.removeEventListener('scroll', check); vv?.removeEventListener('resize', check); };
  }, [pseudoSwipe]);
  const sheetUp = useRef(sheetOpen);
  sheetUp.current = sheetOpen;
  useEffect(() => {
    const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheetUp.current && pseudoEl) { e.stopPropagation(); realFull(false); return; }
      if (e.key === 'Escape' && !sheetUp.current && close.current) { e.stopPropagation(); close.current(); }
      if (e.key === ' ' && !sheetUp.current && !typing(e.target)) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) play.current?.(); }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey && !sheetUp.current && !typing(e.target) && canFull()) { e.preventDefault(); if (!e.repeat) realFull(!fullNow()); }
    };
    const keyUp = (e: KeyboardEvent) => { if (e.key === ' ' && !sheetUp.current && !typing(e.target)) e.preventDefault(); };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', keyUp, true);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', keyUp, true); };
  }, []);
  const sideways = useMedia('(orientation: landscape) and (max-height: 540px)');
  const rootRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setBoxW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const small = compact && !isFull;
  const big = !small && desk && !sideways && (boxW == null || boxW >= 880);
  const mini = !big;
  useEffect(() => {
    setCalm(false);
    if (!transport.playing || sheetOpen) return;
    const h = setTimeout(() => setCalm(true), 3000);
    return () => clearTimeout(h);
  }, [transport.playing, sheetOpen, touchN]);
  const calmRef = useRef(calm); calmRef.current = calm;
  const movedAt = useRef(0);
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const now = Date.now();
    if (!calmRef.current && now - movedAt.current < 1000) return;
    movedAt.current = now;
    setTouchN((n) => n + 1);
  };
  const land = !big && sideways;
  const subBox = useRef<HTMLDivElement>(null);
  const subKey = sub ? sub.words.map((w) => (w.dim ? 0 : 1)).join('') + sub.words.length + ':' + (sub.cursor ?? '') : '';
  const subFit = useRef<() => void>(() => {});
  subFit.current = () => {
    const box = subBox.current;
    if (!box) return;
    const reading = !!sub?.words.some((w) => w.dim) || sub?.cursor != null;
    const said = box.querySelectorAll<HTMLElement>(sub?.cursor != null && !sub.words.some((w) => w.dim) ? '[data-at]' : '[data-said]');
    const row = parseFloat(getComputedStyle(box).lineHeight) || 24;
    const page = Math.max(1, Math.floor((box.clientHeight + 1) / row));
    const room = Math.max(0, Math.round(box.scrollHeight / row) - page) * row;
    if (room <= 0) { if (box.scrollTop) box.scrollTo({ top: 0 }); }
    else {
      const rowOf = (el: HTMLElement) => Math.round((el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop) / row);
      const at = reading ? (said.length ? Math.floor(rowOf(said[said.length - 1]) / page) * page * row : 0) : room;
      const want = Math.max(0, Math.min(room, at));
      if (Math.abs(want - box.scrollTop) > 1) box.scrollTop = want;
    }
    const text = box.querySelector<HTMLElement>(':scope>span');
    let cutTop = 0, cutBottom = 0;
    if (text) {
      const b = box.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(text);
      const pad = parseFloat(getComputedStyle(text).paddingBottom) || 0;
      for (const r of Array.from(range.getClientRects())) {
        if (r.height <= 0) continue;
        if (r.bottom <= b.top + 0.5) cutTop = Math.max(cutTop, pad);
        if (r.top < b.top - 0.5 && r.bottom > b.top + 0.5) cutTop = Math.max(cutTop, r.bottom - b.top);
        if (r.bottom > b.bottom + 0.5 && r.top < b.bottom - 0.5) cutBottom = Math.max(cutBottom, b.bottom - r.top);
      }
    }
    const clip = cutTop || cutBottom ? `inset(${Math.ceil(cutTop)}px 0 ${Math.ceil(cutBottom)}px 0)` : '';
    if (box.style.clipPath !== clip) box.style.clipPath = clip;
  };
  const subText = sub ? sub.words.map((w) => w.t).join('') : '';
  useLayoutEffect(() => { subFit.current(); }, [subKey, subText, land, isFull]);
  const hasSub = !wait && !!sub;
  useEffect(() => {
    const box = subBox.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => subFit.current());
    ro.observe(box);
    return () => ro.disconnect();
  }, [hasSub]);
  const [shareAt, setShareAt] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  const shareT = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(shareT.current), []);
  const shareUrl = paused?.share ? paused.share.url(shareAt && paused.share.at >= 1 ? Math.floor(paused.share.at) : null) : '';
  const shareQr = useMemo(() => (big && shareUrl && !transport.playing ? qrSvgUrl(shareUrl) : ''), [big, shareUrl, transport.playing]);
  const copyShare = () => { void navigator.clipboard?.writeText(shareUrl).then(() => { setShareCopied(true); window.clearTimeout(shareT.current); shareT.current = window.setTimeout(() => setShareCopied(false), 1800); }, () => {}); };
  const shareCard = big && paused?.share && (
    <div className="gfull__sharecard" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {shareQr && <div className="gfull__shareqr" role="img" aria-label="QR code for this link" style={{ backgroundImage: `url("${shareQr}")` }} />}
      <div className="gfull__sharebody">
        <div className="gfull__shareeyebrow">SHARE THIS MOMENT</div>
        <label className="gfull__shareat"><input type="checkbox" checked={shareAt} onChange={(e) => setShareAt(e.target.checked)} disabled={paused.share.at < 1} />Start at {clock(Math.floor(paused.share.at))}</label>
        <div className="gfull__shareurl"><span>{shareUrl.replace(/^https?:\/\//, '')}</span></div>
        <div className="gfull__shareacts">
          <button type="button" className="gfull__sharebtn gfull__sharebtn--main" onClick={copyShare}><Icon d={shareCopied ? D.check : D.copy} size={14} sw={1.8} />{shareCopied ? 'Copied' : 'Copy link'}</button>
          <button type="button" className="gfull__sharebtn" onClick={() => shareLink(shareUrl, title)}><Icon d={D.share} size={14} sw={1.6} />Share</button>
        </div>
      </div>
    </div>
  );
  const glass = (lbl: string, d: string, sw: number, onClick: () => void, style?: React.CSSProperties, grow = 0) => (
    <button type="button" className="gfull__btn" title={lbl} aria-label={lbl} onClick={onClick}><Icon d={d} size={(big ? 20 : mini ? 15 : 18) + grow} sw={sw} style={style} /></button>
  );
  const acts = (
    <div className="gfull__acts">
      {voicesBtn && <VoicesButton v={voicesBtn} size={big ? 20 : mini ? 15 : 18} />}
      {onShare && glass('Share', D.share, 1.6, onShare, { transform: 'translateX(-2px)' })}
      {canFull() && !noFull && glass(isFull ? 'Exit full screen' : 'Full screen', isFull ? ICON_EXIT : ICON_FULL, 1.7, () => realFull(!isFull))}
      {swipeFull && barsUp && !noFull && !canFull() && glass('Full screen', ICON_FULL, 1.7, () => setLoud(true))}
      {onClose && glass('Close player', D.close, 1.7, onClose)}
    </div>
  );
  const top = (mute || cc || onSettings) && (
    <div className="gfull__top">
      {mute && glass(mute.muted ? 'Unmute' : 'Mute', mute.muted ? D.volumeOff : D.volume, 1.6, mute.onToggle)}
      {cc && glass(cc.on ? 'Hide subtitles' : 'Show subtitles', cc.on ? D.cc : D.ccOff, 1.7, cc.onToggle, undefined, 4)}
      {onSettings && glass('Settings', D.cog, 1.6, onSettings)}
    </div>
  );
  return (
    <div ref={rootRef} className={`gfull${big ? ' gfull--desk' : ''}${mini ? ' gfull--mini' : ''}${small ? ' gfull--small' : ''}${swipeFull || pseudoSwipe ? ' gfull--swipe' : ''}${ad ? ' gfull--ad' : ''}${calm ? ' gfull--calm' : ''}`} data-theme="dark" role="dialog" aria-label={title} onPointerMove={onMove} onPointerDownCapture={(e) => { if (calm) swallow.current = true; setTouchN((n) => n + 1); if (!(e.target as Element).closest?.('[aria-label="Exit full screen"], [aria-label="Full screen"], [aria-label="Close player"]')) onTouch(); }}
      onClickCapture={(e) => { if (swallow.current) { swallow.current = false; e.stopPropagation(); e.preventDefault(); } }}>
      {(pseudoSwipe ? pseudoBars : swipeFull && barsUp) && <div className={`gfull__swipe${loud && !pseudoSwipe ? ' gfull__swipe--loud' : ''}`} aria-live="polite"><Icon d="m4.5 15.75 7.5-7.5 7.5 7.5" size={14} sw={2} />Swipe up for full screen</div>}
      <div className={`gfull__frame${land ? ' gfull__frame--land' : ''}`}>
        {picture}
        <div className="gfull__shade" aria-hidden="true" />
        {paused && !ad && (
          <div className={`gfull__pausedinfo${!transport.playing ? ' gfull__pausedinfo--on' : ''}`} aria-hidden={transport.playing}>
            <div className="gfull__pausedtext">
              <div className="gfull__pausedhead">{(mini || small) && <span className="gfull__pausedmark" aria-hidden="true"><Mark dark size={20} /></span>}<div className="gfull__pausedtitle">{paused.title}</div></div>
              {paused.summary && <div className="gfull__pausedsum">{paused.summary}</div>}
            </div>
            {shareCard}
          </div>
        )}
        {top}
        {topLeft && <div className="gfull__topl">{topLeft}</div>}
        {modal}
        {copied}
        {wait ? (
          typeof wait === 'string'
            ? <div className="gfull__sub" aria-live="polite"><div className="gfull__wait"><span className="gfull__spin" aria-hidden="true" />{wait}</div></div>
            : <div className="gfull__sub">{wait}</div>
        ) : sub && (
          <div className="gfull__sub">
            <div ref={subBox}>
              <div className="gfull__subback" aria-hidden="true"><span>{sub.who && <><b>{sub.who}:</b> </>}{sub.words.map((w) => w.t + w.sp).join('')}</span></div>
              <span>{sub.who && <><b style={{ color: sub.color }}>{sub.who}:</b> </>}{sub.words.map((w, j) => <span key={j} data-said={w.dim ? undefined : ''} data-at={sub.cursor != null && j <= sub.cursor ? '' : undefined} style={w.dim ? DIM_WORD : undefined}>{w.t}{w.sp}</span>)}</span>
            </div>
          </div>
        )}
        <div className={`gfull__prog${big ? '' : ' gfull__prog--two'}`}>
          {big ? (
            <>
              <GlassBrand live={pos.live} desk pct={pct} />
              <GlassTransport t={transport} />
              <SeekRow pos={pos} interactive />
              <div className="gfull__chip">{chip}</div>
              {acts}
            </>
          ) : mini ? (
            <div className="gfull__row"><GlassTransport t={transport} mini /><SeekRow pos={pos} interactive /><div className="gfull__chip">{chip}</div>{acts}</div>
          ) : (
            <>
              <div className="gfull__row"><GlassBrand live={pos.live} pct={pct} mark /><SeekRow pos={pos} interactive /></div>
              <div className="gfull__row"><GlassTransport t={transport} /><span style={{ flex: 1 }} /><div className="gfull__chip">{chip}</div>{acts}</div>
            </>
          )}
        </div>
        {picker}
        {sheet}
        {voices}
      </div>
    </div>
  );
}


export function ListenerHeader({ dark, back: onBack, home, live, title, badge, subline, onOptions, optionsActive }: { dark: boolean; back?: () => void; home?: boolean; live?: boolean; title?: string; badge?: React.ReactNode; subline?: string; onOptions: () => void; optionsActive?: boolean }) {
  return (
    <div className="ghead">
      {onBack && <button type="button" className="ghead__back" aria-label="Back" title="Back" onClick={onBack}><Icon d={D.chevronLeft} size={19} sw={1.7} /></button>}
      {live && <span className="mark"><Mark dark={dark} size={30} /></span>}
      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        {home ? (
          <div className="ghead__logo"><Logo dark={dark} height={22} /></div>
        ) : (
          <div className="ghead__title" onClick={onBack} title={onBack ? 'Back' : undefined} style={{ cursor: onBack ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ghead__name">{title}</span>
              {badge}
            </div>
            {subline && <div className="ghead__sub">{subline}</div>}
          </div>
        )}
      </div>
      <IconButton size="sm" bordered={false} variant={optionsActive ? 'primary' : undefined} onClick={onOptions} label="Options">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.85" /><circle cx="12" cy="12" r="1.85" /><circle cx="12" cy="18.5" r="1.85" /></svg>
      </IconButton>
    </div>
  );
}
const VIDEO_D = 'm15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z';
export const modeOptions = (t: Strings, video = false) => [{ value: 'read' as const, label: t.read, icon: <Icon d={D.book} size={17} /> }, { value: 'listen' as const, label: <span style={{ display: 'inline-block', minWidth: 52, textAlign: 'center' }}>{video ? t.watch : t.listen}</span>, icon: <Icon d={video ? VIDEO_D : D.headphones} size={19} sw={1.5} /> }];
