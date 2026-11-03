import { useEffect, useRef, useState } from 'react';
import { PlayGlyph } from '../ds/Icons';

interface FbPlayer { play(): void; pause(): void; seek(s: number): void; mute(): void; getCurrentPosition(): number }
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

export function FacebookFollow({ url, t, playing, seekN, onToggle }: { url: string; t: number; playing: boolean; seekN: number; onToggle?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<FbPlayer | null>(null);
  const tRef = useRef(t); tRef.current = t;
  const [ready, setReady] = useState(false);
  const [id] = useState(() => `vsp-fb-${++seq}`);
  useEffect(() => {
    let live = true;
    const el = box.current;
    if (!el) return;
    el.innerHTML = '';
    const host = document.createElement('div');
    host.className = 'fb-video';
    host.id = id;
    host.setAttribute('data-href', url);
    host.setAttribute('data-width', String(Math.max(320, Math.round(el.clientWidth))));
    host.setAttribute('data-allowfullscreen', 'false');
    host.setAttribute('data-show-text', 'false');
    host.setAttribute('data-show-captions', 'false');
    el.appendChild(host);
    let fb: FbSdk | null = null;
    const onReady = (m: { type: string; id: string; instance: FbPlayer }) => {
      if (!live || m.type !== 'video' || m.id !== id) return;
      player.current = m.instance;
      try { m.instance.mute(); m.instance.seek(Math.max(0, tRef.current)); } catch { }
      setReady(true);
    };
    void loadSdk().then((f) => {
      if (!live || !f) return;
      fb = f;
      f.Event.subscribe('xfbml.ready', onReady);
      f.XFBML.parse(el);
    });
    return () => { live = false; player.current = null; setReady(false); try { fb?.Event.unsubscribe('xfbml.ready', onReady); } catch { } el.innerHTML = ''; };
  }, [url, id]);
  useEffect(() => {
    const p = player.current;
    if (!p || !ready) return;
    try { if (playing) p.play(); else p.pause(); } catch { }
  }, [playing, ready]);
  useEffect(() => {
    const p = player.current;
    if (!p || !ready) return;
    try { p.seek(Math.max(0, tRef.current)); } catch { }
  }, [seekN, ready]);
  useEffect(() => {
    const p = player.current;
    if (!p || !ready || !playing) return;
    const h = setInterval(() => {
      try { if (Math.abs(p.getCurrentPosition() - tRef.current) > 1) p.seek(Math.max(0, tRef.current)); } catch { }
    }, 1000);
    return () => clearInterval(h);
  }, [ready, playing]);
  return (
    <div className="txyt vsp-follow vsp-fb" style={ready ? { background: '#000' } : undefined}>
      <div ref={box} className="vsp-fb__box" style={{ opacity: ready ? 1 : 0 }} />
      {ready && <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
      {ready && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
