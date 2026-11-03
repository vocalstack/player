import { useEffect, useRef, useState } from 'react';

export function FileFollow({ src, t, playing, seekN, onToggle }: { src: string; t: number; playing: boolean; seekN: number; onToggle?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);
  const tRef = useRef(t); tRef.current = t;
  useEffect(() => { setReady(false); setGone(false); }, [src]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !ready) return;
    if (playing) v.play().catch(() => {}); else v.pause();
  }, [playing, ready]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !ready) return;
    const want = Math.max(0, tRef.current);
    if (Math.abs(v.currentTime - want) > (playing ? 0.4 : 0.08)) v.currentTime = want;
  }, [t, seekN, ready, playing]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !ready || !playing) return;
    const h = setInterval(() => {
      const d = v.currentTime - tRef.current;
      if (Math.abs(d) > 0.4) v.currentTime = Math.max(0, tRef.current);
      else v.playbackRate = Math.abs(d) > 0.08 ? (d > 0 ? 0.97 : 1.03) : 1;
    }, 500);
    return () => { clearInterval(h); v.playbackRate = 1; };
  }, [ready, playing]);
  if (gone) return null;
  return (
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
      onError={() => setGone(true)}
      onClick={onToggle}
      aria-hidden="true"
    />
  );
}
