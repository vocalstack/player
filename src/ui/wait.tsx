import { useEffect, useState } from 'react';
import { D, Icon } from '../ds/Icons';


export type PlayerWaitKind = 'translating' | 'voice' | 'starting' | 'translateFailed' | 'voiceFailed';
export interface PlayerWaitState {
  kind: PlayerWaitKind;
  lang: string;
  since?: number | null;
}

export function playerWaitOf(o: {
  lang: string | null; langName: string;
  translating: boolean; translateFailed: string | null;
  voiceFailed: boolean; relang: boolean; starting: number | null | undefined;
  slowLine: boolean; lineSince: number | null;
}): PlayerWaitState | null {
  if (!o.lang) return null;
  const lang = o.langName;
  if (o.translateFailed === o.lang) return { kind: 'translateFailed', lang };
  if (o.voiceFailed) return { kind: 'voiceFailed', lang };
  if (o.translating) return { kind: 'translating', lang };
  if (o.starting != null) return { kind: 'starting', lang, since: o.starting };
  if (o.relang || o.slowLine) return { kind: 'voice', lang, since: o.lineSince };
  return null;
}

export function useHeld(on: boolean, ms: number): [boolean, number | null] {
  const [since, setSince] = useState<number | null>(null);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on) { setSince(null); setHeld(false); return; }
    const at = Date.now();
    setSince(at);
    const h = setTimeout(() => setHeld(true), ms);
    return () => clearTimeout(h);
  }, [on, ms]);
  return [held, since];
}

const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function PlayerWait({ state, line, onRetry, onOriginal }: {
  state: PlayerWaitState;
  line?: string | null;
  onRetry: () => void;
  onOriginal: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.since == null) return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [state.since]);
  const elapsed = state.since != null ? Math.max(0, Math.floor((now - state.since) / 1000)) : null;
  const failed = state.kind === 'translateFailed' || state.kind === 'voiceFailed';
  const title = {
    translating: `Translating into ${state.lang}`,
    voice: `Preparing the ${state.lang} voice`,
    starting: `Starting the ${state.lang} voice`,
    translateFailed: `Couldn’t translate into ${state.lang}`,
    voiceFailed: `The ${state.lang} voice didn’t start`,
  }[state.kind];
  const note = {
    translating: 'The video carries on in the new language as soon as the words are ready — usually a few seconds.',
    voice: 'It plays on its own as soon as the first line is ready.',
    starting: 'The voice is waking up. The first line can take up to a minute; after that it reads straight on.',
    translateFailed: 'Something went wrong on our side. Try again, or watch with the original sound.',
    voiceFailed: 'It took too long to start. Try again, or watch with the original sound.',
  }[state.kind];
  return (
    <div className={`pwait${failed ? ' pwait--failed' : ''}`} data-kind={state.kind} role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'}
      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="pwait__head">
        {failed
          ? <div className="pwait__mark" aria-hidden="true"><Icon d={D.warnCircle} size={18} sw={1.8} /></div>
          : <div className="pwait__spin" aria-hidden="true" />}
        <div className="pwait__t">{title}</div>
        {!failed && elapsed != null && elapsed >= 3 && <div className="pwait__clock" aria-label={`${elapsed} seconds`}>{clockOf(elapsed)}</div>}
      </div>
      <div className="pwait__note">{note}</div>
      {!failed && <div className="pwait__bar" aria-hidden="true"><div /></div>}
      {failed && (
        <div className="pwait__acts">
          <button type="button" className="vs-btn vs-btn--primary vs-btn--sm" onClick={onRetry}>Try again</button>
          <button type="button" className="vs-btn vs-btn--ghost vs-btn--sm" onClick={onOriginal}>Watch in the original</button>
        </div>
      )}
      {!failed && line && <div className="pwait__line" aria-hidden="true">{line}</div>}
    </div>
  );
}
