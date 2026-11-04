import { useEffect, useRef, useState } from 'react';
import { PlayGlyph } from '../ds/Icons';

interface WVideo { play(): void; pause(): void; time(t?: number): number; mute(): void; volume(v?: number): number; hashedId(): string }
type W = Window & { _wq?: unknown[] };

let script: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (script) return script;
  script = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://fast.wistia.net/assets/external/E-v1.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return script;
}

export function WistiaFollow({ id, t, playing, seekN, onToggle }: { id: string; t: number; playing: boolean; seekN: number; onToggle?: () => void }) {
  const video = useRef<WVideo | null>(null);
  const tRef = useRef(t); tRef.current = t;
  const playRef = useRef(playing); playRef.current = playing;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const w = window as W;
    w._wq = w._wq || [];
    w._wq.push({
      id,
      onReady: (v: WVideo) => {
        if (!live) return;
        video.current = v;
        try { v.mute(); v.time(Math.max(0, tRef.current)); if (playRef.current) v.play(); } catch { }
        setReady(true);
      },
    });
    void loadScript();
    return () => { live = false; video.current = null; setReady(false); };
  }, [id]);
  useEffect(() => {
    const v = video.current;
    if (!v || !ready) return;
    try { if (playing) { v.time(Math.max(0, tRef.current)); v.play(); } else v.pause(); } catch { }
  }, [playing, ready]);
  useEffect(() => {
    const v = video.current;
    if (!v || !ready) return;
    try { v.time(Math.max(0, tRef.current)); } catch { }
  }, [seekN, ready]);
  useEffect(() => {
    const v = video.current;
    if (!v || !ready || !playing) return;
    const h = setInterval(() => {
      try { if (Math.abs(v.time() - tRef.current) > 0.5) v.time(Math.max(0, tRef.current)); } catch { }
    }, 500);
    return () => clearInterval(h);
  }, [ready, playing]);
  const src = `https://fast.wistia.net/embed/iframe/${encodeURIComponent(id)}?${new URLSearchParams({ muted: 'true', playbar: 'false', controlsVisibleOnLoad: 'false', playButton: 'false', smallPlayButton: 'false', volumeControl: 'false', fullscreenButton: 'false', settingsControl: 'false', endVideoBehavior: 'reset' })}`;
  return (
    <div className="txyt vsp-follow" style={ready ? { background: '#000' } : undefined}>
      <iframe src={src} className="wistia_embed vsp-embed" name="wistia_embed" title="Video" allow="autoplay; fullscreen" style={{ opacity: ready ? 1 : 0, pointerEvents: 'none' }} tabIndex={-1} aria-hidden="true" />
      {<div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
      {ready && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
