import { useEffect, useMemo, useRef, useState } from 'react';
import { embedSignal, embedUrl } from '../core/embeds';
import { PlayGlyph } from '../ds/Icons';

export function EmbedFollow({ url, t, playing, seekN, title, onToggle }: { url: string; t: number; playing: boolean; seekN: number; title: string; onToggle?: () => void }) {
  const tRef = useRef(t); tRef.current = t;
  const [ready, setReady] = useState(false);
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const src = useMemo(() => embedUrl(url, { t: tRef.current, play: playing, host }), [url, playing, seekN, host]); // eslint-disable-line react-hooks/exhaustive-deps
  const [failed, setFailed] = useState(false);
  const heard = useRef(false);
  useEffect(() => {
    const sig = embedSignal(url);
    if (!sig) return;
    heard.current = false;
    setFailed(false);
    const onMsg = (e: MessageEvent) => { try { if (sig.test(new URL(e.origin).hostname)) heard.current = true; } catch { } };
    window.addEventListener('message', onMsg);
    const h = window.setTimeout(() => { if (!heard.current) setFailed(true); }, 8000);
    return () => { window.removeEventListener('message', onMsg); window.clearTimeout(h); };
  }, [url]);
  if (!src || failed) return null;
  return (
    <div className="txyt vsp-follow" style={ready ? { background: '#000' } : undefined}>
      <iframe
        key={src}
        className="vsp-embed"
        src={src}
        title={title}
        style={{ opacity: ready ? 1 : 0, pointerEvents: 'none' }}
        onLoad={() => setReady(true)}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        tabIndex={-1}
        aria-hidden="true"
      />
      {<div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
      {ready && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
