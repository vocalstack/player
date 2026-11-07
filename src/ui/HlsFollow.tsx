import { useEffect, useRef, useState } from 'react';
import type { YtLead } from './core';
import { videoState } from '../core/videoState';

type HlsLike = { destroy: () => void; loadSource: (u: string) => void; attachMedia: (v: HTMLMediaElement) => void; on: (e: string, cb: (e: unknown, d: { fatal?: boolean; response?: { code?: number } }) => void) => void };

export function HlsFollow({ src, lead, onGone, onToggle }: { src: string; lead: YtLead; onGone?: () => void; onToggle?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const goneRef = useRef(onGone); goneRef.current = onGone;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let alive = true;
    let hls: HlsLike | null = null;
    v.muted = true;
    const say = (i: Parameters<YtLead['onInfo']>[0]) => { if (alive) lead.onInfo(i); };
    const state = () => say({ state: videoState(v) });
    const time = () => say({ t: v.currentTime });
    const onMeta = () => { setReady(true); say({ ready: true, muted: v.muted }); state(); };
    const onVol = () => say({ muted: v.muted });
    const events: [string, () => void][] = [['loadedmetadata', onMeta], ['playing', state], ['pause', state], ['waiting', state], ['seeking', state], ['seeked', state], ['ended', state], ['canplay', state], ['timeupdate', time], ['volumechange', onVol]];
    for (const [e, f] of events) v.addEventListener(e, f);
    const tick = window.setInterval(() => { if (!v.paused) time(); }, 250);
    lead.bind((func, args = []) => {
      const n = typeof args[0] === 'number' ? args[0] : 0;
      if (func === 'playVideo') v.play().catch(() => state());
      else if (func === 'pauseVideo') v.pause();
      else if (func === 'seekTo') v.currentTime = Math.max(0, n);
      else if (func === 'mute') v.muted = true;
      else if (func === 'unMute') v.muted = false;
      else if (func === 'setVolume') v.volume = Math.max(0, Math.min(1, n / 100));
      else if (func === 'setPlaybackRate') v.playbackRate = n || 1;
    });
    const gone = () => { if (alive) goneRef.current?.(); };
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = src;
      v.addEventListener('error', gone);
    } else {
      import('hls.js').then((mod) => {
        const Hls = mod.default;
        if (!alive) return;
        if (!Hls?.isSupported()) { gone(); return; }
        const h = new Hls({ maxBufferLength: 30, manifestLoadingMaxRetry: 60, manifestLoadingRetryDelay: 2000, manifestLoadingMaxRetryTimeout: 4000, levelLoadingMaxRetry: 10, fragLoadingMaxRetry: 6 }) as unknown as HlsLike;
        hls = h;
        h.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal) return;
          h.destroy();
          hls = null;
          gone();
        });
        h.loadSource(src);
        h.attachMedia(v);
      }).catch(gone);
    }
    return () => {
      alive = false;
      window.clearInterval(tick);
      for (const [e, f] of events) v.removeEventListener(e, f);
      v.removeEventListener('error', gone);
      lead.bind(null);
      hls?.destroy();
      v.removeAttribute('src');
      v.load();
    };
  }, [src, lead]);
  return (
    <div className="txyt vsp-follow" style={ready ? { background: '#000' } : undefined}>
      <video ref={ref} className="vsp-file" style={{ opacity: ready ? 1 : 0 }} muted playsInline preload="auto" disablePictureInPicture aria-hidden="true" />
      {ready && <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />}
    </div>
  );
}
