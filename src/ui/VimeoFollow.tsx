import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayGlyph } from '../ds/Icons';
import { VIMEO_ORIGIN, vimeoFrame, vimeoLoud, vimeoMsg, vimeoNow, vmStep, type VmState } from '../core/vimeo';

const EVENTS = ['timeupdate', 'play', 'playing', 'pause', 'ended', 'seeked', 'bufferstart', 'bufferend', 'volumechange', 'loaded', 'error'];

export function VimeoFollow({ id, h, t, playing, seekN, title, onToggle }: { id: string; h?: string | null; t: number; playing: boolean; seekN: number; title: string; onToggle?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const tRef = useRef(t); tRef.current = t;
  const playRef = useRef(playing); playRef.current = playing;
  const st = useRef<VmState>({ t: null, at: 0, playing: false, buffering: false, duration: null });
  const seekedAt = useRef(0);
  const lead = useRef(0.3);
  const learn = useRef(false);
  const refine = useRef(0);
  const [made, setMade] = useState(false);
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  const src = useMemo(() => vimeoFrame(id, { t: tRef.current, h }), [id, h]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = (method: string, value?: unknown) => {
    try { frame.current?.contentWindow?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), VIMEO_ORIGIN); } catch { }
  };
  const quiet = () => { send('setVolume', 0); send('setMuted', true); };
  const seekTo = (to: number) => { learn.current = playRef.current; seekedAt.current = Date.now(); st.current.t = Math.max(0, to); st.current.at = performance.now(); send('setCurrentTime', Math.max(0, to)); };
  useEffect(() => {
    let live = true;
    setMade(false); setShown(false); setGone(false);
    st.current = { t: null, at: 0, playing: false, buffering: false, duration: null };
    const lost = window.setTimeout(() => { if (live && !st.current.duration && st.current.t == null) setGone(true); }, 20000);
    const on = (e: MessageEvent) => {
      if (!live || e.source !== frame.current?.contentWindow) return;
      const m = vimeoMsg(e.origin, e.data);
      if (!m) return;
      const s = st.current;
      const d = m.data ?? {};
      if (m.event === 'ready') {
        for (const ev of EVENTS) send('addEventListener', ev);
        quiet();
        send('getDuration');
        setMade(true);
        return;
      }
      if (m.method === 'getDuration' && typeof m.value === 'number') { s.duration = m.value; return; }
      if ((m.method === 'getMuted' && m.value === false) || (m.method === 'getVolume' && typeof m.value === 'number' && m.value > 0)) { quiet(); return; }
      switch (m.event) {
        case 'timeupdate': case 'playProgress':
          if (typeof d.seconds === 'number') { s.t = d.seconds; s.at = performance.now(); }
          if (typeof d.duration === 'number' && d.duration > 0) s.duration = d.duration;
          if (s.playing) setShown(true);
          break;
        case 'play': case 'playing': s.playing = true; s.ended = false; if (typeof d.seconds === 'number') { s.t = d.seconds; s.at = performance.now(); } break;
        case 'pause': s.playing = false; break;
        case 'ended': case 'finish': s.playing = false; s.ended = true; break;
        case 'bufferstart': s.buffering = true; break;
        case 'bufferend': s.buffering = false; s.at = performance.now(); break;
        case 'seeked': case 'seek':
          if (typeof d.seconds === 'number') { s.t = d.seconds; s.at = performance.now(); }
          break;
        case 'volumechange': if (vimeoLoud(d)) quiet(); break;
        case 'error': if (!s.duration && s.t == null) setGone(true); break;
        case 'loaded': setShown(true); break;
      }
    };
    window.addEventListener('message', on);
    return () => { live = false; window.clearTimeout(lost); window.removeEventListener('message', on); };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!made) return;
    refine.current = 2;
    if (playing) { seekTo(tRef.current + lead.current); send('play'); } else { send('pause'); seekTo(tRef.current); }
  }, [playing, made]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!made) return;
    refine.current = 2;
    seekTo(tRef.current + (playRef.current ? lead.current : 0));
  }, [seekN, made]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!made) return;
    const hd = window.setInterval(() => {
      const s = st.current;
      const now = performance.now();
      const settling = Date.now() - seekedAt.current < 2500;
      if (!settling && learn.current && playRef.current && s.playing && !s.buffering) {
        const at = vimeoNow(s, now);
        learn.current = false;
        if (at != null) {
          const d = at - tRef.current;
          lead.current = Math.max(0, Math.min(1.5, lead.current - 0.7 * d));
          if (Math.abs(d) > 0.3 && refine.current > 0) { refine.current--; seekTo(tRef.current + lead.current); return; }
        }
      }
      const step = vmStep(s, { t: tRef.current, playing: playRef.current, settling, lead: lead.current }, now);
      if (step.kind === 'seek') seekTo(step.to);
      else if (step.kind === 'play') send('play');
      else if (step.kind === 'pause') send('pause');
    }, 500);
    const mute = window.setInterval(() => { send('getMuted'); send('getVolume'); }, 2000);
    return () => { window.clearInterval(hd); window.clearInterval(mute); };
  }, [made]); // eslint-disable-line react-hooks/exhaustive-deps
  if (gone) return null;
  return (
    <div className="txyt vsp-follow" style={shown ? { background: '#000' } : undefined}>
      <iframe
        ref={frame}
        className="vsp-embed vsp-vimeo"
        src={src}
        title={title}
        style={{ opacity: shown ? 1 : 0, pointerEvents: 'none' }}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        tabIndex={-1}
        onLoad={() => send('ping')}
        aria-hidden="true"
      />
      <div aria-hidden="true" className="txyt__tap" onClick={onToggle} style={{ cursor: onToggle ? 'pointer' : 'default' }} />
      {shown && <div className={`txyt__paused${!playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div>}
    </div>
  );
}
