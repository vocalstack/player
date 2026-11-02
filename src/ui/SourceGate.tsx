import { useState } from 'react';
import { D, Icon, Logo, Spinner } from '../ds/Icons';
import { ytIdOf } from '../core/youtube';
import { openPopup, type PopupStatus, type Started } from '../data/connect';

const STATUS: Record<PopupStatus, string> = {
  'signing-in': 'Sign in to VocalStack in the window that opened…',
  consent: 'Confirm in the VocalStack window…',
  checking: 'Looking for your transcription of this video…',
  starting: 'Starting the transcription…',
};

export function hostOf(src: string): string {
  try { return new URL(src).hostname.replace(/^www\./, ''); } catch { return src; }
}

export function SourceGate({ src, appUrl, title, onReady }: { src: string; appUrl?: string; title?: string; onReady: (s: Started) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<PopupStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const yt = ytIdOf(src);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const s = await openPopup(appUrl, { url: src, ask: true }, setStatus);
      if (s) onReady(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };
  return (
    <div className="vsp-gate" data-theme="dark">
      {yt && <div className="vsp-gate__bg" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${yt}/hqdefault.jpg)` }} />}
      <div className="vsp-end__card vsp-gate__card">
        <div className="vsp-end__brand"><Logo dark link={false} height={16} /></div>
        <div className="vsp-end__title">{title ?? 'Watch with subtitles and spoken translations'}</div>
        <div className="vsp-end__note">{`From ${hostOf(src)}. If you have transcribed it with VocalStack it plays right away; if not, you can start it here.`}</div>
        <button type="button" className="vsp-end__go vsp-gate__go" onClick={() => void go()} disabled={busy}>
          {busy ? <Spinner size={15} color="#050507" track="rgba(5,5,7,.2)" /> : <><Icon d={D.cc} size={16} sw={1.7} />Open with VocalStack</>}
        </button>
        {busy && <div className="vsp-end__note" role="status">{STATUS[status ?? 'checking']}</div>}
        {err && <div className="vsp-end__err" role="alert">{err}</div>}
        <div className="vsp-end__foot"><span>Uses your VocalStack account. You'll be asked to sign in if you're not.</span></div>
      </div>
    </div>
  );
}
