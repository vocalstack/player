import { useCallback, useState, type ReactNode } from 'react';
import { D, Icon, Spinner } from '../ds/Icons';
import { ytIdOf } from '../core/youtube';
import { openPopup, rememberConnected, wasConnected, type PopupStatus, type Started } from '../data/connect';
import { FullVideo, type PlayerPos, type PlayerTransport } from './full';
import { useDesk } from './useDesk';

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

const NOW: PlayerPos = { live: false, atEdge: false, edgeFrac: null, pct: 0, atLabel: '0:00', labelAt: () => '0:00', endLabel: '0:00', onSeek: () => {} };

function IdlePlayer({ poster, title, page, onAct, children }: { poster: string | null; title: string; page: boolean; onAct: () => void; children: ReactNode }) {
  const desk = useDesk();
  const transport: PlayerTransport = { prevOn: false, nextOn: false, onPrev: () => {}, onNext: () => {}, playing: false, playable: true, playTitle: 'Connect to play', onPlay: onAct };
  const picture = <div className="vsp-idle__pic" style={poster ? { backgroundImage: `url(${poster})` } : undefined} />;
  return (
    <>
      <FullVideo page={page} noFull picture={picture} title={title} desk={desk} pos={NOW} sub={null} mute={{ muted: true, onToggle: onAct }} cc={{ on: true, onToggle: onAct }} chip={null} transport={transport} picker={null} sheet={null} voices={null} voicesBtn={null} sheetOpen={false} onSettings={onAct} copied={null} onTouch={() => {}} />
      <div className="vsp-idle" data-theme="dark">{children}</div>
    </>
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

export function SourceGate({ src, ask, connect, page, onClear }: { src: string; ask: boolean; connect: Connect; page: boolean; onClear?: () => void }) {
  const yt = ytIdOf(src);
  const go = () => connect.start(src, ask);
  return (
    <IdlePlayer poster={yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null} title={hostOf(src)} page={page} onAct={go}>
      <ConnectButton connect={connect} onClick={go} label={connect.connected ? 'Play with VocalStack' : 'Connect to VocalStack'} />
      {!connect.busy && <div className="vsp-idle__note">{connect.connected ? `Plays ${hostOf(src)} with subtitles and spoken translations.` : `Connect to play ${hostOf(src)} with subtitles and spoken translations.`}</div>}
      {onClear && !connect.busy && <button type="button" className="vsp-idle__other" onClick={onClear}>Choose another video</button>}
    </IdlePlayer>
  );
}

export function StartCard({ connect, page, onPick }: { connect: Connect; page: boolean; onPick: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const clean = url.trim();
  const ok = LINK.test(clean);
  const submit = () => {
    if (!ok || connect.busy) return;
    const full = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    onPick(full);
    connect.start(full, false);
  };
  if (!connect.connected) {
    return (
      <IdlePlayer poster={null} title="VocalStack" page={page} onAct={connect.connect}>
        <ConnectButton connect={connect} onClick={connect.connect} label="Connect to VocalStack" />
        {!connect.busy && <div className="vsp-idle__note">Connect your VocalStack account to watch any video with subtitles and spoken translations.</div>}
      </IdlePlayer>
    );
  }
  return (
    <IdlePlayer poster={null} title="VocalStack" page={page} onAct={() => {}}>
      <form className="vsp-idle__form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input className="vsp-end__input" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="Paste a video link: YouTube, Vimeo, an mp3…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Video link" autoFocus />
        <button type="submit" className="vsp-end__go" disabled={!ok || connect.busy}>{connect.busy ? <Spinner size={15} color="#050507" track="rgba(5,5,7,.2)" /> : 'Play'}</button>
      </form>
      {connect.busy ? <div className="vsp-idle__note" role="status">{STATUS[connect.status ?? 'checking']}</div> : <div className="vsp-idle__note">It plays here with subtitles and spoken translations.</div>}
      {connect.err && <div className="vsp-end__err" role="alert">{connect.err}</div>}
    </IdlePlayer>
  );
}
