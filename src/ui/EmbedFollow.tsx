import { useMemo, useRef, useState } from 'react';
import { embedUrl } from '../core/embeds';
import { PlayGlyph } from '../ds/Icons';

export function EmbedFollow({ url, t, playing, seekN, title, onToggle }: { url: string; t: number; playing: boolean; seekN: number; title: string; onToggle?: () => void }) {
  const tRef = useRef(t); tRef.current = t;
  const [ready, setReady] = useState(false);
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const src = useMemo(() => embedUrl(url, { t: tRef.current, play: playing, host }), [url, playing, seekN, host]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!src) return null;
  return (
    <div className="txyt vsp-follow" style={ready ? { background: '#000' } : undefined}>
      <iframe
        key={src}
        className="vsp-embed"
        src={src}
        title={title}
        style={{ opacity: ready ? 1 : 0, pointerEvents: playing ? 'auto' : 'none' }}
        onLoad={() => setReady(true)}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        tabIndex={-1}
        aria-hidden="true"
      />
      {!playing && <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
      {ready && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
