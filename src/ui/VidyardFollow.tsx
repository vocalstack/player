import { useEffect, useRef, useState } from 'react';
import { PlayGlyph } from '../ds/Icons';

interface VPlayer { play(): void; pause(): void; seek(s: number): void; currentTime(): number; setVolume(v: number): void; uuid: string }
interface VApi { renderPlayer(o: { uuid: string; container: HTMLElement; type?: string; autoplay?: number; muted?: number; controls?: number }): Promise<VPlayer> }
type W = Window & { VidyardV4?: { api: VApi } };

let script: Promise<VApi | null> | null = null;

function loadApi(): Promise<VApi | null> {
  if (script) return script;
  script = new Promise((resolve) => {
    const w = window as W;
    if (w.VidyardV4) { resolve(w.VidyardV4.api); return; }
    const s = document.createElement('script');
    s.src = 'https://play.vidyard.com/embed/v4.js';
    s.async = true;
    s.onload = () => {
      const started = Date.now();
      const wait = () => { if (w.VidyardV4) resolve(w.VidyardV4.api); else if (Date.now() - started > 8000) resolve(null); else setTimeout(wait, 50); };
      wait();
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return script;
}

export function VidyardFollow({ uuid, t, playing, seekN, onToggle }: { uuid: string; t: number; playing: boolean; seekN: number; onToggle?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<VPlayer | null>(null);
  const tRef = useRef(t); tRef.current = t;
  const playRef = useRef(playing); playRef.current = playing;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const el = box.current;
    if (!el) return;
    el.innerHTML = '';
    void loadApi().then((api) => {
      if (!live || !api) return;
      return api.renderPlayer({ uuid, container: el, type: 'inline', autoplay: 0, muted: 1, controls: 0 }).then((p) => {
        if (!live) return;
        player.current = p;
        try { p.setVolume(0); p.seek(Math.max(0, tRef.current)); if (playRef.current) p.play(); } catch { }
        setReady(true);
      });
    }).catch(() => {});
    return () => { live = false; player.current = null; setReady(false); el.innerHTML = ''; };
  }, [uuid]);
  useEffect(() => {
    const p = player.current;
    if (!p || !ready) return;
    try { if (playing) { p.seek(Math.max(0, tRef.current)); p.play(); } else p.pause(); } catch { }
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
      try { if (Math.abs(p.currentTime() - tRef.current) > 0.5) p.seek(Math.max(0, tRef.current)); } catch { }
    }, 500);
    return () => clearInterval(h);
  }, [ready, playing]);
  return (
    <div className="txyt vsp-follow" style={ready ? { background: '#000' } : undefined}>
      <div ref={box} className={`vsp-fb__box${playing ? ' vsp-fb__box--live' : ''}`} style={{ opacity: ready ? 1 : 0 }} />
      {!playing && <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
      {ready && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
