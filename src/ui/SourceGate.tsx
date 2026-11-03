import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { D, Icon, Spinner } from '../ds/Icons';
import { ytIdOf } from '../core/youtube';
import { siteOf } from '../core/sites';
import { openPopup, rememberConnected, wasConnected, type PopupStatus, type Started } from '../data/connect';
import { FullVideo, type PlayerPos, type PlayerTransport } from './full';
import { useDesk } from './useDesk';
import { useIdleControls, type IdlePrefs } from './IdleSettings';
import { shareLink } from './shared';
import { shareCodeOf } from '../core/share';
import { ProviderGrid } from './Providers';

export interface IdleState { prefs: IdlePrefs; set: (p: Partial<IdlePrefs>) => void; shareUrl?: string }

const STATUS: Record<PopupStatus, string> = {
  'signing-in': 'Sign in to VocalStack in the window that opened…',
  consent: 'Confirm in the VocalStack window…',
  looking: 'Looking for your transcription of this video…',
  confirm: 'Confirm in the VocalStack window…',
  checking: 'Checking the link…',
  starting: 'Starting the transcription…',
};

const LINK = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;

export function hostOf(src: string): string {
  try { return new URL(src).hostname.replace(/^www\./, ''); } catch { return src; }
}

export interface Connect {
  busy: boolean;
  status: PopupStatus | null;
  err: string | null;
  connected: boolean;
  connect: () => void;
  start: (url: string, ask: boolean) => void;
}

export function useConnect(appUrl: string | undefined, onReady: (s: Started) => void): Connect {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<PopupStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [connected, setConnected] = useState(() => wasConnected(appUrl));
  const run = useCallback((ask: Parameters<typeof openPopup>[1]) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    let p: ReturnType<typeof openPopup>;
    try { p = openPopup(appUrl, ask, setStatus); } catch (e) { p = Promise.reject(e); }
    p.then((s) => {
      if (!s) return;
      rememberConnected(appUrl);
      setConnected(true);
      if (s !== 'connected') onReady(s);
    })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.'))
      .finally(() => { setBusy(false); setStatus(null); });
  }, [appUrl, busy, onReady]);
  const connect = useCallback(() => run({ connect: true }), [run]);
  const start = useCallback((url: string, ask: boolean) => run({ url, ask }), [run]);
  return { busy, status, err, connected, connect, start };
}

function isMedia(src: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i.test(src);
}

function Backdrop({ poster, src }: { poster: string | null; src: string | null }) {
  const yt = src && siteOf(src)?.id === 'youtube' ? ytIdOf(src) : null;
  const img = poster ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null);
  if (img) return <div className="vsp-idle__pic" style={{ backgroundImage: `url(${img})` }} />;
  if (src && isMedia(src)) return <video className="vsp-idle__pic vsp-idle__frame" src={`${src}#t=1`} muted playsInline preload="metadata" aria-hidden="true" />;
  return <><div className="vsp-idle__pic vsp-idle__pic--brand" /><ProviderGrid /></>;
}

const NOW: PlayerPos = { live: false, atEdge: false, edgeFrac: null, pct: 0, atLabel: '0:00', labelAt: () => '0:00', endLabel: '0:00', onSeek: () => {} };

function IdlePlayer({ idle, poster, src, title, page, onAct, children }: { idle: IdleState; poster: string | null; src: string | null; title: string; page: boolean; onAct: () => void; children: ReactNode }) {
  const ctl = useIdleControls(idle.prefs, idle.set);
  const desk = useDesk();
  const box = useRef<HTMLDivElement>(null);
  const [small, setSmall] = useState(false);
  useLayoutEffect(() => {
    const el = box.current?.parentElement;
    if (!el) return;
    const measure = () => setSmall(el.getBoundingClientRect().width < 560);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const transport: PlayerTransport = { prevOn: false, nextOn: false, onPrev: () => {}, onNext: () => {}, playing: false, playable: true, playTitle: 'Connect to play', onPlay: onAct };
  return (
    <div ref={box} className={`vsp-idleroot${small ? ' vsp-idleroot--small' : ''}`}>
      <FullVideo page={page} picture={<Backdrop poster={poster} src={src} />} title={title} desk={desk} pos={NOW} sub={null} mute={{ muted: idle.prefs.muted, onToggle: () => idle.set({ muted: !idle.prefs.muted }) }} cc={{ on: idle.prefs.subtitles, onToggle: () => idle.set({ subtitles: !idle.prefs.subtitles }) }} chip={ctl.chip} transport={transport} picker={ctl.sheets} sheet={null} voices={null} voicesBtn={null} sheetOpen={ctl.sheetOpen} onSettings={ctl.openSettings} onShare={() => shareLink(idle.shareUrl ?? window.location.href, title)} copied={null} onTouch={() => {}} />
      {!ctl.sheetOpen && <div className="vsp-idle" data-theme="dark"><div className="vsp-idle__box">{children}</div></div>}
    </div>
  );
}

function ConnectButton({ connect, onClick, label }: { connect: Connect; onClick: () => void; label: string }) {
  return (
    <>
      <button type="button" className="vsp-idle__connect" onClick={onClick} disabled={connect.busy}>
        {connect.busy ? <Spinner size={18} color="#050507" track="rgba(5,5,7,.2)" /> : <Icon d={D.link} size={18} sw={1.8} />}
        <span>{connect.busy ? 'Waiting for VocalStack…' : label}</span>
      </button>
      {connect.busy && <div className="vsp-idle__note" role="status">{STATUS[connect.status ?? 'checking']}</div>}
      {connect.err && <div className="vsp-end__err" role="alert">{connect.err}</div>}
    </>
  );
}

export function SourceGate({ idle, src, ask, connect, page, poster = null, onClear }: { idle: IdleState; src: string; ask: boolean; connect: Connect; page: boolean; poster?: string | null; onClear?: () => void }) {
  const go = () => connect.start(src, ask);
  return (
    <IdlePlayer idle={idle} poster={poster} src={src} title={hostOf(src)} page={page} onAct={go}>
      <ConnectButton connect={connect} onClick={go} label={connect.connected ? 'Play with VocalStack' : 'Connect to VocalStack'} />
      {!connect.busy && <div className="vsp-idle__note">{connect.connected ? `Plays ${hostOf(src)} with subtitles and spoken translations.` : `Connect to play ${hostOf(src)} with subtitles and spoken translations.`}</div>}
      {onClear && !connect.busy && <button type="button" className="vsp-idle__other" onClick={onClear}>Choose another video</button>}
    </IdlePlayer>
  );
}

export function StartCard({ idle, connect, page, poster = null, onPick, onShare }: { idle: IdleState; connect: Connect; page: boolean; poster?: string | null; onPick: (url: string) => void; onShare?: (code: string) => Promise<boolean> }) {
  const [url, setUrl] = useState('');
  const [opening, setOpening] = useState(false);
  const [shareErr, setShareErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAuto = useRef<string | null>(null);
  const clean = url.trim();
  const isLink = (v: string) => LINK.test(v) || !!shareCodeOf(v);
  const ok = isLink(clean);
  const busy = connect.busy || opening;
  const launch = async (raw: string) => {
    const full = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setShareErr(null);
    const code = shareCodeOf(full);
    if (code && onShare) {
      setOpening(true);
      const found = await onShare(code).catch(() => false);
      setOpening(false);
      if (found) return;
      if (!connect.connected) { setShareErr('That share link does not open. It may have been revoked.'); return; }
    }
    onPick(full);
    connect.start(full, false);
  };
  const submit = () => { if (ok && !busy) void launch(clean); };
  const go = () => { if (ok) submit(); else if (!connect.connected) connect.connect(); else inputRef.current?.focus(); };
  const auto = (v: string) => {
    const c = v.trim();
    if (!isLink(c) || busy || c === lastAuto.current) return;
    lastAuto.current = c;
    void launch(c);
  };
  const note = connect.busy ? <div className="vsp-idle__note" role="status">{STATUS[connect.status ?? 'checking']}</div>
    : opening ? <div className="vsp-idle__note" role="status">Opening the shared transcript…</div>
    : <div className="vsp-idle__note">{connect.connected ? 'Paste a VocalStack share link, or a YouTube, Vimeo, mp3 or any video link to play it here with subtitles and spoken translations.' : 'Paste a VocalStack share link to watch it here, or connect to transcribe any video link.'}</div>;
  return (
    <IdlePlayer idle={idle} poster={poster} src={null} title="VocalStack" page={page} onAct={go}>
      <form className="vsp-idle__form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <span className="vsp-idle__field">
          <Icon d={D.link} size={16} sw={1.8} />
          <input ref={inputRef} className="vsp-idle__input" type="url" inputMode="url" enterKeyHint="go" autoComplete="off" spellCheck={false} placeholder={connect.connected ? 'Paste a video link' : 'Paste a share link'} value={url} onChange={(e) => setUrl(e.target.value)} onPaste={(e) => { const v = e.clipboardData.getData('text'); if (v) { setUrl(v.trim()); auto(v); e.preventDefault(); } }} aria-label="Video link" autoFocus={connect.connected} />
          {busy && <Spinner size={15} color="#eef0f8" track="rgba(255,255,255,.2)" />}
        </span>
      </form>
      {note}
      {!connect.connected && !busy && <ConnectButton connect={connect} onClick={connect.connect} label="Connect to VocalStack" />}
      {(shareErr || connect.err) && <div className="vsp-end__err" role="alert">{shareErr ?? connect.err}</div>}
    </IdlePlayer>
  );
}

export function ErrorGate({ idle, message, onRetry, page }: { idle: IdleState; message: string; onRetry: () => void; page: boolean }) {
  return (
    <IdlePlayer idle={idle} poster={null} src={null} title="VocalStack" page={page} onAct={onRetry}>
      <div className="vsp-idle__err" role="alert"><Icon d={D.warn} size={16} sw={1.8} />{message}</div>
      <button type="button" className="vsp-idle__connect" onClick={onRetry}><Icon d={D.uturn} size={18} sw={1.8} /><span>Try again</span></button>
    </IdlePlayer>
  );
}
