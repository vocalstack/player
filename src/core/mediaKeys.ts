import { useEffect, useRef } from 'react';

export type MediaKey = 'play' | 'pause' | 'stop' | 'nexttrack' | 'previoustrack';

export interface MediaKeyTarget {
  playing: boolean;
  toggle: () => void;
  next?: () => void;
  prev?: () => void;
}

export const MEDIA_KEYS: MediaKey[] = ['play', 'pause', 'stop', 'nexttrack', 'previoustrack'];

export function onMediaKey(key: MediaKey, t: MediaKeyTarget): void {
  if (key === 'play') { if (!t.playing) t.toggle(); return; }
  if (key === 'pause' || key === 'stop') { if (t.playing) t.toggle(); return; }
  if (key === 'nexttrack') { t.next?.(); return; }
  t.prev?.();
}

export interface MediaSessionLike {
  setActionHandler: (action: MediaKey, handler: (() => void) | null) => void;
}

export function bindMediaKeys(ms: MediaSessionLike, get: () => MediaKeyTarget | null): () => void {
  for (const k of MEDIA_KEYS) {
    try { ms.setActionHandler(k, () => { const t = get(); if (t) onMediaKey(k, t); }); } catch { }
  }
  return () => {
    for (const k of MEDIA_KEYS) {
      try { ms.setActionHandler(k, null); } catch { }
    }
  };
}

export function useMediaKeys(target: MediaKeyTarget | null, title?: string | null): void {
  const ref = useRef(target);
  ref.current = target;
  const on = !!target;
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms || !on) return;
    return bindMediaKeys(ms, () => ref.current);
  }, [on]);
  const playing = !!target?.playing;
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms || !on) return;
    ms.playbackState = playing ? 'playing' : 'paused';
  }, [on, playing]);
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms || !on || !title || typeof MediaMetadata === 'undefined') return;
    try { ms.metadata = new MediaMetadata({ title, artist: 'VocalStack' }); } catch { }
  }, [on, title]);
}
