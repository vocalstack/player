import { useEffect, useRef, useState } from 'react';
import { PlayGlyph } from '../ds/Icons';
import { fbFit, fbNow, fbSample, fbState, fbStep, fbWidth } from '../core/facebook';

interface FbPlayer { play(): void; pause(): void; seek(s: number): void; mute(): void; unmute(): void; setVolume(v: number): void; getVolume?(): number; getCurrentPosition(): number; getDuration?(): number; subscribe?(e: string, cb: () => void): { release?: (e?: string) => void } | void }
interface FbSdk { init(o: object): void; XFBML: { parse(el?: Element): void }; Event: { subscribe(e: string, cb: (m: { type: string; id: string; instance: FbPlayer }) => void): void; unsubscribe(e: string, cb: unknown): void } }
type W = Window & { FB?: FbSdk; fbAsyncInit?: () => void };

let sdk: Promise<FbSdk | null> | null = null;

function loadSdk(): Promise<FbSdk | null> {
  if (sdk) return sdk;
  sdk = new Promise((resolve) => {
    const w = window as W;
    if (w.FB) { resolve(w.FB); return; }
    const prev = w.fbAsyncInit;
    w.fbAsyncInit = () => { prev?.(); w.FB?.init({ xfbml: false, version: 'v19.0' }); resolve(w.FB ?? null); };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
  return sdk;
}

let seq = 0;

const EVENTS = ['startedPlaying', 'paused', 'finishedPlaying', 'startedBuffering', 'finishedBuffering', 'error'] as const;

export function FacebookFollow({ url, t, playing, seekN, onToggle }: { url: string; t: number; playing: boolean; seekN: number; onToggle?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<FbPlayer | null>(null);
  const tRef = useRef(t); tRef.current = t;
  const playRef = useRef(playing); playRef.current = playing;
  const st = useRef(fbState());
  const seekedAt = useRef(0);
  const lead = useRef(0.3);
  const learn = useRef(false);
  const refine = useRef(0);
  const [ready, setReady] = useState(false);
  const [id] = useState(() => `vsp-fb-${++seq}`);
  const seekTo = (to: number) => {
    const p = player.current;
    if (!p) return;
    learn.current = playRef.current;
    seekedAt.current = Date.now();
    st.current.t = Math.max(0, to);
    st.current.at = performance.now();
    try { p.seek(Math.max(0, to)); } catch { }
  };
  useEffect(() => {
    let live = true;
    const el = box.current;
    if (!el) return;
    el.innerHTML = '';
    st.current = fbState();
    const host = document.createElement('div');
    host.className = 'fb-video';
    host.id = id;
    host.setAttribute('data-href', url);
    host.setAttribute('data-width', String(fbWidth(el.clientWidth, window.screen?.width ?? 0)));
    host.setAttribute('data-allowfullscreen', 'false');
    host.setAttribute('data-show-text', 'false');
    host.setAttribute('data-show-captions', 'false');
    el.appendChild(host);
    const fit = () => {
      const f = host.querySelector('iframe');
      if (!f) return;
      const w = parseFloat(f.style.width) || f.offsetWidth;
      const h = parseFloat(f.style.height) || f.offsetHeight;
      const { scale } = fbFit({ w: el.clientWidth, h: el.clientHeight }, { w, h });
      host.style.width = `${w}px`;
      host.style.height = `${h}px`;
      host.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(fit) : null;
    mo?.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'width', 'height'] });
    let fb: FbSdk | null = null;
    const subs: Array<{ release?: (e?: string) => void } | void> = [];
    const onReady = (m: { type: string; id: string; instance: FbPlayer }) => {
      if (!live || m.type !== 'video' || m.id !== id) return;
      const p = m.instance;
      player.current = p;
      const s = st.current;
      const on = (e: (typeof EVENTS)[number]) => () => {
        if (!live) return;
        if (e === 'startedPlaying') { s.playing = true; s.ended = false; s.buffering = false; }
        else if (e === 'paused') { s.playing = false; if (playRef.current) { try { p.play(); } catch { } } }
        else if (e === 'finishedPlaying') { s.playing = false; s.ended = true; }
        else if (e === 'startedBuffering') s.buffering = true;
        else if (e === 'finishedBuffering') { s.buffering = false; s.at = performance.now(); }
      };
      for (const e of EVENTS) { try { subs.push(p.subscribe?.(e, on(e))); } catch { } }
      try { const d = p.getDuration?.(); if (typeof d === 'number' && d > 0) s.duration = d; } catch { }
      try { p.setVolume(0); p.unmute(); p.setVolume(0); } catch { }
      seekTo(tRef.current);
      fit();
      setReady(true);
    };
    void loadSdk().then((f) => {
      if (!live || !f) return;
      fb = f;
      f.Event.subscribe('xfbml.ready', onReady);
      f.XFBML.parse(el);
    });
    return () => {
      live = false;
      player.current = null;
      setReady(false);
      ro?.disconnect();
      mo?.disconnect();
      for (const x of subs) { try { x?.release?.(); } catch { } }
      try { fb?.Event.unsubscribe('xfbml.ready', onReady); } catch { }
      el.innerHTML = '';
    };
  }, [url, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = player.current;
    if (!p || !ready) return;
    refine.current = 2;
    try {
      if (playing) { p.setVolume(0); seekTo(tRef.current + lead.current); p.play(); }
      else { p.pause(); seekTo(tRef.current); }
    } catch { }
  }, [playing, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!player.current || !ready) return;
    refine.current = 2;
    seekTo(tRef.current + (playRef.current ? lead.current : 0));
  }, [seekN, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    const sample = () => {
      const p = player.current;
      if (!p) return;
      try { fbSample(st.current, p.getCurrentPosition(), performance.now()); } catch { }
    };
    const fast = window.setInterval(sample, 40);
    const hd = window.setInterval(() => {
      const p = player.current;
      if (!p) return;
      const s = st.current;
      const now = performance.now();
      if (!s.duration) { try { const d = p.getDuration?.(); if (typeof d === 'number' && d > 0) s.duration = d; } catch { } }
      const settling = Date.now() - seekedAt.current < 2500;
      if (!settling && learn.current && playRef.current && s.playing && !s.buffering) {
        const at = fbNow(s, now);
        learn.current = false;
        if (at != null) {
          const d = at - tRef.current;
          lead.current = Math.max(0, Math.min(1.5, lead.current - 0.7 * d));
          if (Math.abs(d) > 0.3 && refine.current > 0) { refine.current--; seekTo(tRef.current + lead.current); return; }
        }
      }
      const step = fbStep(s, { t: tRef.current, playing: playRef.current, settling, lead: lead.current }, now);
      try {
        if (step.kind === 'seek') seekTo(step.to);
        else if (step.kind === 'play') p.play();
        else if (step.kind === 'pause') p.pause();
      } catch { }
    }, 500);
    const quiet = window.setInterval(() => {
      const p = player.current;
      try { if (p && (p.getVolume?.() ?? 0) > 0) p.setVolume(0); } catch { }
    }, 2000);
    return () => { window.clearInterval(fast); window.clearInterval(hd); window.clearInterval(quiet); };
  }, [ready]);
  return (
    <div className="txyt vsp-follow vsp-fb" style={ready ? { background: '#000' } : undefined}>
      <div ref={box} className={`vsp-fb__box${playing ? ' vsp-fb__box--live' : ''}`} style={{ opacity: ready ? 1 : 0 }} />
      {ready && <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
      {ready && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
