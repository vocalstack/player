import { useCallback, useState } from 'react';
import { D, Icon, Logo, Spinner } from '../ds/Icons';
import { ytIdOf } from '../core/youtube';
import { openPopup, type PopupStatus, type Started } from '../data/connect';

const STATUS: Record<PopupStatus, string> = {
  'signing-in': 'Sign in to VocalStack in the window that opened…',
  consent: 'Confirm in the VocalStack window…',
  checking: 'Looking for your transcription of this video…',
  starting: 'Starting the transcription…',
};

const LINK = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;

export function hostOf(src: string): string {
  try { return new URL(src).hostname.replace(/^www\./, ''); } catch { return src; }
}

export interface Connect { busy: boolean; status: PopupStatus | null; err: string | null; start: (url: string, ask: boolean) => void }

export function useConnect(appUrl: string | undefined, onReady: (s: Started) => void): Connect {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<PopupStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const start = useCallback((url: string, ask: boolean) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    let p: Promise<Started | null>;
    try { p = openPopup(appUrl, { url, ask }, setStatus); } catch (e) { p = Promise.reject(e); }
    p.then((s) => { if (s) onReady(s); })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.'))
      .finally(() => { setBusy(false); setStatus(null); });
  }, [appUrl, busy, onReady]);
  return { busy, status, err, start };
}

const PLAY = <path d="M7.5 5.6a1 1 0 0 1 1.52-.85l9.1 5.55a1 1 0 0 1 0 1.7l-9.1 5.55a1 1 0 0 1-1.52-.85V5.6Z" />;

export function SourceGate({ src, ask, connect, onClear }: { src: string; ask: boolean; connect: Connect; onClear?: () => void }) {
  const yt = ytIdOf(src);
  const { busy, status, err } = connect;
  return (
    <div className="vsp-gate vsp-gate--paused" data-theme="dark">
      {yt ? <div className="vsp-gate__poster" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${yt}/hqdefault.jpg)` }} /> : <div className="vsp-gate__poster vsp-gate__poster--plain"><Icon d={D.video} size={56} sw={1.2} /></div>}
      <div className="vsp-gate__shade" />
      <div className="vsp-gate__top">
        <span className="vsp-gate__src" title={src}>{hostOf(src)}</span>
        {onClear && <button type="button" className="vsp-end__close vsp-gate__clear" aria-label="Choose another video" title="Choose another video" onClick={onClear}><Icon d={D.close} size={16} sw={1.8} /></button>}
      </div>
      <div className="vsp-gate__center">
        <button type="button" className="vsp-gate__connect" onClick={() => connect.start(src, ask)} disabled={busy}>
          {busy ? <Spinner size={18} color="#050507" track="rgba(5,5,7,.2)" /> : <span className="vsp-gate__mark"><Logo dark={false} link={false} height={15} /></span>}
          <span>{busy ? 'Waiting for VocalStack…' : 'Connect to VocalStack'}</span>
        </button>
        <div className="vsp-gate__note" role={busy ? 'status' : undefined}>{busy ? STATUS[status ?? 'checking'] : 'Connect to play this video with subtitles and spoken translations.'}</div>
        {err && <div className="vsp-end__err" role="alert">{err}</div>}
      </div>
      <div className="vsp-gate__bar" aria-hidden="true">
        <span className="vsp-gate__play"><svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" style={{ marginLeft: 2 }}>{PLAY}</svg></span>
        <span className="vsp-gate__track"><i /></span>
        <span className="vsp-gate__time">0:00</span>
      </div>
    </div>
  );
}

export function StartCard({ connect, onPick }: { connect: Connect; onPick: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const clean = url.trim();
  const ok = LINK.test(clean);
  const submit = () => {
    if (!ok || connect.busy) return;
    const full = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    onPick(full);
    connect.start(full, false);
  };
  return (
    <div className="vsp-gate" data-theme="dark">
      <div className="vsp-end__card vsp-gate__card">
        <div className="vsp-end__brand"><Logo dark link={false} height={16} /></div>
        <div className="vsp-end__title">Transcribe and translate any video</div>
        <div className="vsp-end__note">Paste a link from YouTube, Vimeo, an mp3 or any page with a video. It plays right here with subtitles and spoken translations.</div>
        <form className="vsp-end__row" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input className="vsp-end__input" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Video link" />
          <button type="submit" className="vsp-end__go" disabled={!ok || connect.busy}>Transcribe</button>
        </form>
        <div className="vsp-end__foot"><span>Uses your VocalStack account. You'll be asked to sign in if you're not.</span></div>
      </div>
    </div>
  );
}
