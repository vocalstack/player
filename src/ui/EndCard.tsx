import { useState } from 'react';
import { D, Icon, Logo, Spinner } from '../ds/Icons';
import { startFromEmbed, type Started } from '../data/connect';

export interface EndCardOptions {
  appUrl?: string;
  title?: string;
  note?: string;
}

const LINK = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;

export function EndCard({ options, onStarted, onReplay }: { options: EndCardOptions; onStarted: (s: Started) => void; onReplay: () => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = url.trim();
  const ok = LINK.test(clean);
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const s = await startFromEmbed(options.appUrl, /^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
      if (s) onStarted(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="vsp-end" role="dialog" aria-label="Transcribe another video" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="vsp-end__card">
        <div className="vsp-end__brand"><Logo dark link={false} height={16} /></div>
        <div className="vsp-end__title">{options.title ?? 'Transcribe and translate any video'}</div>
        <div className="vsp-end__note">{options.note ?? 'Paste a link from YouTube, Vimeo or any page with a video. It plays right here with subtitles and spoken translations.'}</div>
        <form className="vsp-end__row" onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <input className="vsp-end__input" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://youtube.com/watch?v=…" value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} aria-label="Video link" />
          <button type="submit" className="vsp-end__go" disabled={!ok || busy}>{busy ? <Spinner size={15} color="#050507" track="rgba(5,5,7,.2)" /> : 'Transcribe'}</button>
        </form>
        {err && <div className="vsp-end__err" role="alert">{err}</div>}
        <div className="vsp-end__foot">
          <span>Uses your VocalStack account. You'll be asked to sign in if you're not.</span>
          <button type="button" className="vsp-end__replay" onClick={onReplay}><Icon d={D.uturn} size={14} sw={1.8} />Replay</button>
        </div>
      </div>
    </div>
  );
}
