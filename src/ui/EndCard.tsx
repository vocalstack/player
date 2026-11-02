import { useEffect, useState } from 'react';
import { D, Icon, Logo, Spinner } from '../ds/Icons';
import { startFromEmbed, type PopupStatus, type Started } from '../data/connect';

export interface EndCardOptions {
  appUrl?: string;
  title?: string;
  note?: string;
}

const STATUS: Record<PopupStatus, string> = {
  'signing-in': 'Sign in to VocalStack in the window that opened…',
  consent: 'Confirm in the VocalStack window…',
  looking: 'Looking for your transcription of this video…',
  confirm: 'Confirm in the VocalStack window…',
  checking: 'Checking the link…',
  starting: 'Starting the transcription…',
};

const LINK = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;

export function EndCard({ options, onStarted, onReplay, onClose }: { options: EndCardOptions; onStarted: (s: Started) => void; onReplay: () => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<PopupStatus | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const clean = url.trim();
  const ok = LINK.test(clean);
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const s = await startFromEmbed(options.appUrl, /^https?:\/\//i.test(clean) ? clean : `https://${clean}`, setStatus);
      if (s) onStarted(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };
  return (
    <div className="vsp-end" role="dialog" aria-label="Transcribe another video" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="vsp-end__card">
        <button type="button" className="vsp-end__close" aria-label="Close" title="Close" onClick={onClose}><Icon d={D.close} size={16} sw={1.8} /></button>
        <div className="vsp-end__brand"><Logo dark link={false} height={16} /></div>
        <div className="vsp-end__title">{options.title ?? 'Transcribe and translate any video'}</div>
        <div className="vsp-end__note">{options.note ?? 'Paste a link from YouTube, Vimeo or any page with a video. It plays right here with subtitles and spoken translations.'}</div>
        <form className="vsp-end__row" onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <input className="vsp-end__input" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://youtube.com/watch?v=…" value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} aria-label="Video link" />
          <button type="submit" className="vsp-end__go" disabled={!ok || busy}>{busy ? <Spinner size={15} color="#050507" track="rgba(5,5,7,.2)" /> : 'Transcribe'}</button>
        </form>
        {busy && <div className="vsp-end__note" role="status">{STATUS[status ?? 'checking']}</div>}
        {err && <div className="vsp-end__err" role="alert">{err}</div>}
        <div className="vsp-end__foot">
          <span>Uses your VocalStack account. You'll be asked to sign in if you're not.</span>
          <button type="button" className="vsp-end__replay" onClick={onReplay}><Icon d={D.uturn} size={14} sw={1.8} />Replay</button>
        </div>
      </div>
    </div>
  );
}
