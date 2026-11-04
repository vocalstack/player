import { useEffect, useRef, useState } from 'react';
import { PlayGlyph } from '../ds/Icons';
import { dailymotionLib, dmLoud, dmStep, type DmState } from '../core/dailymotion';

interface DmPlayer {
  play(): void; pause(): void; seek(t: number): void; setMute(m: boolean): void; setVolume?(v: number): void;
  getState(): Promise<DmState>;
  on(ev: string, cb: (s: DmState) => void): void;
  loadContent?(o: { video: string; startTime?: number }): void;
  destroy?(): void;
}
interface DmApi { createPlayer(id: string, o: { video: string; params?: Record<string, unknown> }): Promise<DmPlayer>; events: Record<string, string> }
type W = Window & { dailymotion?: DmApi & { onScriptLoaded?: () => void } };

const libs = new Map<string, Promise<DmApi | null>>();

function loadLib(src: string): Promise<DmApi | null> {
  const had = libs.get(src);
  if (had) return had;
  const p = new Promise<DmApi | null>((resolve) => {
    const w = window as W;
    const done = () => {
      const started = Date.now();
      const wait = () => { if (typeof w.dailymotion?.createPlayer === 'function') resolve(w.dailymotion); else if (Date.now() - started > 8000) resolve(null); else setTimeout(wait, 50); };
      wait();
    };
    if (typeof w.dailymotion?.createPlayer === 'function') { resolve(w.dailymotion); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = done;
    s.onerror = () => { libs.delete(src); resolve(null); };
    document.head.appendChild(s);
  });
  libs.set(src, p);
  return p;
}

let seq = 0;

export function DailymotionFollow({ video, player: playerId, t, playing, seekN, onToggle }: { video: string; player?: string | null; t: number; playing: boolean; seekN: number; onToggle?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<DmPlayer | null>(null);
  const tRef = useRef(t); tRef.current = t;
  const playRef = useRef(playing); playRef.current = playing;
  const seekedAt = useRef(0);
  const seekTo = (p: DmPlayer, to: number) => { seekedAt.current = Date.now(); try { p.seek(Math.max(0, to)); } catch { } };
  const [made, setMade] = useState(false);
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let live = true;
    const el = box.current;
    if (!el) return;
    setMade(false); setShown(false); setGone(false);
    const slot = document.createElement('div');
    slot.id = `vsp-dm-${++seq}`;
    el.appendChild(slot);
    const lead = window.setTimeout(() => { if (live && !player.current) setGone(true); }, 15000);
    void loadLib(dailymotionLib(playerId)).then((api) => {
      if (!live) return;
      if (!api) { setGone(true); return; }
      return api.createPlayer(slot.id, { video, params: { startTime: Math.max(0, Math.floor(tRef.current)), mute: true } }).then((p) => {
        if (!live) { try { p.destroy?.(); } catch { } return; }
        player.current = p;
        const ev = api.events;
        const show = () => { if (live) setShown(true); };
        const quiet = () => { try { p.setVolume?.(0); p.setMute(true); } catch { } };
        const apply = () => {
          quiet();
          try {
            if (playRef.current) p.play(); else p.pause();
          } catch { }
        };
        for (const k of ['VIDEO_PLAYING', 'VIDEO_TIMECHANGE', 'AD_START', 'AD_PLAY']) if (ev[k]) p.on(ev[k], show);
        if (ev.PLAYER_CRITICALPATHREADY) p.on(ev.PLAYER_CRITICALPATHREADY, apply);
        if (ev.PLAYER_ERROR) p.on(ev.PLAYER_ERROR, () => { if (live) setGone(true); });
        if (ev.PLAYER_VOLUMECHANGE) p.on(ev.PLAYER_VOLUMECHANGE, (s) => { if (dmLoud(s)) quiet(); });
        apply();
        setMade(true);
      });
    }).catch(() => { if (live) setGone(true); });
    return () => {
      live = false;
      window.clearTimeout(lead);
      const p = player.current;
      player.current = null;
      try { p?.destroy?.(); } catch { }
      el.innerHTML = '';
    };
  }, [video, playerId]);
  useEffect(() => {
    const p = player.current;
    if (!p || !made) return;
    try { if (playing) { seekTo(p, tRef.current); p.play(); } else p.pause(); } catch { }
  }, [playing, made]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = player.current;
    if (!p || !made) return;
    seekTo(p, tRef.current);
  }, [seekN, made]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = player.current;
    if (!p || !made) return;
    let busy = false;
    const h = window.setInterval(() => {
      if (busy) return;
      busy = true;
      p.getState().then((s) => {
        if (dmLoud(s)) { p.setVolume?.(0); p.setMute(true); }
        const step = dmStep(s, { video, t: tRef.current, playing: playRef.current, settling: Date.now() - seekedAt.current < 3000 });
        if (step.kind === 'reload') p.loadContent?.({ video, startTime: Math.max(0, Math.floor(tRef.current)) });
        else if (step.kind === 'seek') seekTo(p, step.to);
        else if (step.kind === 'play') p.play();
        else if (step.kind === 'pause') p.pause();
      }).catch(() => {}).finally(() => { busy = false; });
    }, 1000);
    return () => window.clearInterval(h);
  }, [made, video]);
  if (gone) return null;
  return (
    <div className="txyt vsp-follow" style={shown ? { background: '#000' } : undefined}>
      <div ref={box} className="vsp-fb__box vsp-dm" style={{ opacity: shown ? 1 : 0 }} />
      <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />
      {shown && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
