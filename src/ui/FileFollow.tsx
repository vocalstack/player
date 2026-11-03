import { useEffect, useRef, useState } from 'react';
import { PlayGlyph } from '../ds/Icons';

export type FollowSetup = (v: HTMLVideoElement, fail: () => void) => (() => void) | void;

export function FileFollow({ src, setup, t, playing, seekN, onToggle, seekOver = 0.4 }: { src?: string; setup?: FollowSetup; t: number; playing: boolean; seekN: number; onToggle?: () => void; seekOver?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);
  const tRef = useRef(t); tRef.current = t;
  useEffect(() => { setReady(false); setGone(false); }, [src, setup]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !setup) return;
    return setup(v, () => setGone(true)) ?? undefined;
  }, [setup]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !ready) return;
    if (playing) v.play().catch(() => {}); else v.pause();
  }, [playing, ready]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !ready) return;
    const want = Math.max(0, tRef.current);
    if (Math.abs(v.currentTime - want) > (playing ? seekOver : 0.08)) v.currentTime = want;
  }, [t, seekN, ready, playing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = ref.current;
    if (!v || !ready || !playing) return;
    const h = setInterval(() => {
      if (v.seeking) return;
      const d = v.currentTime - tRef.current;
      if (Math.abs(d) > seekOver) v.currentTime = Math.max(0, tRef.current);
      else v.playbackRate = Math.abs(d) < 0.03 ? 1 : Math.min(1.1, Math.max(0.9, 1 - 0.5 * d));
    }, 250);
    return () => { clearInterval(h); v.playbackRate = 1; };
  }, [ready, playing, seekOver]);
  if (gone) return null;
  return (
    <div className="txyt vsp-follow" style={ready ? { background: '#000' } : undefined}>
    <video
      ref={ref}
      className="vsp-file"
      style={{ opacity: ready ? 1 : 0 }}
      src={src}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      onLoadedData={() => setReady(true)}
      onError={() => { if (src) setGone(true); }}
      aria-hidden="true"
    />
    {ready && <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
    {ready && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
