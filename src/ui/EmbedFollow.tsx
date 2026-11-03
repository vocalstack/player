import { useMemo, useRef, useState } from 'react';
import { embedUrl } from '../core/embeds';

export function EmbedFollow({ url, t, playing, seekN, title }: { url: string; t: number; playing: boolean; seekN: number; title: string }) {
  const tRef = useRef(t); tRef.current = t;
  const [ready, setReady] = useState(false);
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const src = useMemo(() => embedUrl(url, { t: tRef.current, play: playing, host }), [url, playing, seekN, host]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!src) return null;
  return (
    <>
    {ready && <div className="vsp-embed__bg" aria-hidden="true" />}
    <iframe
      key={src}
      className="vsp-embed"
      src={src}
      title={title}
      style={{ opacity: ready ? 1 : 0 }}
      onLoad={() => setReady(true)}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      tabIndex={-1}
      aria-hidden="true"
    />
    </>
  );
}
