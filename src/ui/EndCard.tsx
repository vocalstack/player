import { useEffect, useState } from 'react';
import { D, Icon, Mark, Spinner } from '../ds/Icons';
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
    <div className="vsp-end vsp-end--v2" role="dialog" aria-label="Transcribe another video" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <button type="button" className="gfull__btn vsp-end2__close" aria-label="Close" title="Close" onClick={onClose}><Icon d={D.close} size={17} sw={1.8} /></button>
      <div className="vsp-end2">
        <span className="vsp-end2__mark"><Mark dark size={26} /></span>
        <div className="vsp-end2__title">{options.title ?? 'Watch another video in your language'}</div>
        <form className="vsp-end2__field" onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <Icon d={D.link} size={16} sw={1.8} style={{ flex: 'none', color: 'rgba(238,240,248,.55)' }} />
          <input className="vsp-end2__input" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="Paste a video link" value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} aria-label="Video link" />
          <button type="submit" className="vsp-end2__go" disabled={!ok || busy} aria-label="Transcribe" title="Transcribe">{busy ? <Spinner size={15} color="#06101c" track="rgba(6,16,28,.25)" /> : <Icon d={D.arrowRight} size={17} sw={2} />}</button>
        </form>
        <div className="vsp-end2__note" role={busy ? 'status' : undefined}>{busy ? STATUS[status ?? 'checking'] : (options.note ?? 'YouTube, Vimeo, TikTok and more, with subtitles and spoken translations.')}</div>
        {err && <div className="vsp-end__err" role="alert">{err}</div>}
        <button type="button" className="vsp-end2__replay" onClick={onReplay}><Icon d={D.uturn} size={14} sw={1.8} />Replay</button>
      </div>
    </div>
  );
}
