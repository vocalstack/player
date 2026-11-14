import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Switch, Toggle } from '../ds/Controls';
import { D, Icon, Spinner } from '../ds/Icons';
import { clock } from '../core/format';
import { choiceFor, kindFor, mdPage, parseClock, readExportPrefs, srtAsVtt, vttCues, keepPrefs, type ExportChoice, type ExportKind, type ExportSpeakersOpt, type ExportTab, type ExportTextKind, type Prefs } from '../core/exportOptions';
export { choiceFor, kindFor, readExportPrefs, tabOf, type ExportChoice, type ExportKind, type ExportSpeakersOpt, type ExportTab, type ExportTextKind, type ExportTimestampsOpt } from '../core/exportOptions';

const TABS: { value: ExportTab; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'subs', label: 'Subtitles' },
  { value: 'text', label: 'Text' },
  { value: 'json', label: 'JSON' },
];

const SPEAKER_LABELS: { value: ExportSpeakersOpt; label: string }[] = [{ value: 'auto', label: 'When Needed' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }];
const TIMESTAMPS = [{ value: 'paragraph' as const, label: 'Paragraph' }, { value: 'line' as const, label: 'Every line' }, { value: 'off' as const, label: 'Off' }];

const NOTE: Record<ExportTab, string> = {
  pdf: 'A printable document in paragraphs.',
  xlsx: 'One row per line, with start, end and confidence.',
  subs: 'Timed captions for a video editor or a player.',
  text: 'The transcript as text, to read, copy or paste anywhere.',
  json: 'Every word with its timing and confidence, for code.',
};

const PREVIEW_OF: Record<Exclude<ExportTab, 'json'>, (p: Prefs) => ExportTextKind> = {
  pdf: () => 'md',
  xlsx: () => 'vtt',
  subs: (p) => p.subs,
  text: (p) => p.text,
};

function PaperPreview({ src, limit }: { src: string; limit: number }) {
  const page = useMemo(() => mdPage(src), [src]);
  return (
    <div className="vsx-paper" aria-label="PDF preview">
      <div className="vsx-paper__title">{page.title}</div>
      {page.meta && <div className="vsx-paper__meta">{page.meta}</div>}
      {page.summary.length > 0 && (
        <div className="vsx-paper__summary">
          <div className="vsx-paper__h">Summary</div>
          {page.summary.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
      {page.blocks.slice(0, limit).map((b, i) => (
        <div key={i} className="vsx-paper__block">
          {(b.when || b.who) && (
            <div className="vsx-paper__head">
              {b.when && <span>{b.when}</span>}
              {b.who && <span className="vsx-paper__who">{b.who}</span>}
            </div>
          )}
          <p>{b.text}</p>
        </div>
      ))}
      {page.blocks.length > limit && <div className="vsx-fade" aria-hidden="true" />}
    </div>
  );
}

function SheetPreview({ src, limit }: { src: string; limit: number }) {
  const cues = useMemo(() => vttCues(src).slice(0, limit), [src, limit]);
  const speakers = cues.some((c) => c.who);
  const cols = ['#', 'Start', 'End', ...(speakers ? ['Speaker'] : []), 'Text', 'Confidence'];
  return (
    <div className="vsx-sheet" aria-label="Excel preview">
      <table>
        <thead>
          <tr className="vsx-sheet__letters"><th aria-hidden="true" />{cols.map((_, i) => <th key={i}>{String.fromCharCode(65 + i)}</th>)}</tr>
          <tr><th aria-hidden="true">1</th>{cols.map((c) => <th key={c} className="vsx-sheet__head">{c}</th>)}</tr>
        </thead>
        <tbody>
          {cues.map((c, i) => (
            <tr key={i}>
              <th aria-hidden="true">{i + 2}</th>
              <td className="num">{i + 1}</td>
              <td className="num">{c.start}</td>
              <td className="num">{c.end}</td>
              {speakers && <td>{c.who}</td>}
              <td className="vsx-sheet__text">{c.text}</td>
              <td className="num vsx-dim">…</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaptionPreview({ src }: { src: string }) {
  const cues = useMemo(() => vttCues(src).slice(0, 8), [src]);
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (cues.length < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % cues.length), 2600);
    return () => window.clearInterval(id);
  }, [cues]);
  const c = cues[i];
  return (
    <div className="vsx-frame" aria-label="Subtitles preview">
      <div className="vsx-frame__time">{c ? `${c.start} → ${c.end}` : ''}</div>
      {c && <div key={i} className="vsx-frame__cap">{c.who ? `${c.who}: ` : ''}{c.text}</div>}
    </div>
  );
}

function trimmed(src: string, max: number) {
  if (src.length <= max) return src;
  const cut = src.lastIndexOf('\n\n', max);
  return src.slice(0, cut > max / 2 ? cut : max);
}

export function ExportStudio({ open, onClose, initial, onExport, onText, durationS, positionS, hasSummary, speakerLabels }: {
  open: boolean;
  onClose: () => void;
  initial?: ExportTab;
  onExport: (k: ExportKind, c: ExportChoice) => void | Promise<unknown>;
  onText: (k: ExportTextKind, c: ExportChoice) => Promise<string>;
  durationS?: number | null;
  positionS?: () => number | null;
  hasSummary?: boolean;
  speakerLabels?: ExportSpeakersOpt;
}) {
  const [tab, setTab] = useState<ExportTab>(initial ?? 'pdf');
  const [prefs, setPrefs] = useState<Prefs>(readExportPrefs);
  const [fromS, setFromS] = useState('');
  const [toS, setToS] = useState('');
  const [preview, setPreview] = useState<{ key: string; text: string } | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'download' | 'copy' | null>(null);
  const [done, setDone] = useState<'download' | 'copy' | null>(null);
  const cache = useRef(new Map<string, Promise<string>>());
  const dialog = useRef<HTMLDivElement>(null);
  const doneT = useRef<number | undefined>(undefined);

  useEffect(() => { if (open) { setTab(initial ?? 'pdf'); setPrefs(readExportPrefs()); } }, [open, initial]);
  useEffect(() => () => window.clearTimeout(doneT.current), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    dialog.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const set = (f: (p: Prefs) => Prefs) => setPrefs((p) => { const n = f(p); keepPrefs(n); return n; });
  const start = parseClock(fromS);
  const end = parseClock(toS);
  const rangeBad = (fromS.trim() !== '' && start == null) || (toS.trim() !== '' && end == null) || (start != null && end != null && end <= start);
  const range = rangeBad ? {} : { ...(start ? { startS: start } : {}), ...(end != null ? { endS: end } : {}) };
  const choice = choiceFor(tab, prefs, range);
  const kind = kindFor(tab, prefs);
  const previewKind = tab === 'json' ? null : PREVIEW_OF[tab](prefs);
  const previewChoice: ExportChoice = tab === 'xlsx' ? { ...range, ...(prefs.speakers.xlsx ? { speakerLabels: prefs.speakers.xlsx } : {}) } : choice;
  const previewKey = previewKind ? `${previewKind}|${JSON.stringify(previewChoice)}` : '';

  const textOf = (k: ExportTextKind, c: ExportChoice) => {
    const key = `${k}|${JSON.stringify(c)}`;
    let p = cache.current.get(key);
    if (!p) {
      p = onText(k, c);
      cache.current.set(key, p);
      p.catch(() => cache.current.delete(key));
    }
    return p;
  };

  useEffect(() => {
    if (!open || !previewKind) return;
    let live = true;
    setPreviewErr(null);
    const t = window.setTimeout(() => {
      textOf(previewKind, previewChoice)
        .then((text) => { if (live) setPreview({ key: previewKey, text }); })
        .catch((e: unknown) => { if (live) setPreviewErr(e instanceof Error ? e.message : 'The preview could not be loaded.'); });
    }, 180);
    return () => { live = false; window.clearTimeout(t); };
  }, [open, previewKey]);

  const flash = (k: 'download' | 'copy') => { window.clearTimeout(doneT.current); setDone(k); doneT.current = window.setTimeout(() => setDone(null), 1600); };
  const download = () => {
    if (busy || rangeBad) return;
    setBusy('download');
    Promise.resolve().then(() => onExport(kind, choice)).then(() => flash('download')).catch(() => { }).finally(() => setBusy(null));
  };
  const copyKind: ExportTextKind | null = tab === 'subs' ? prefs.subs : tab === 'text' ? prefs.text : tab === 'pdf' || tab === 'xlsx' ? 'txt' : null;
  const copy = () => {
    if (busy || rangeBad || !copyKind) return;
    setBusy('copy');
    const c: ExportChoice = tab === 'xlsx' ? { ...previewChoice, timestamps: 'line' } : choice;
    textOf(copyKind, c)
      .then((text) => navigator.clipboard.writeText(text))
      .then(() => flash('copy'))
      .catch((e: unknown) => setPreviewErr(e instanceof Error ? e.message : 'The text could not be copied.'))
      .finally(() => setBusy(null));
  };

  if (!open) return null;
  const shown = preview && preview.key === previewKey ? preview.text : null;
  const stale = preview != null && preview.key !== previewKey;
  const speakersTab = tab === 'json' ? null : tab;
  const tsTab = tab === 'pdf' || tab === 'text' ? tab : null;
  const here = () => { const p = positionS?.(); return p != null && Number.isFinite(p) ? clock(p) : null; };
  const dur = durationS && durationS > 0 ? clock(durationS) : null;
  const fileLabel = { pdf: 'PDF', xlsx: 'Excel', srt: 'SRT', vtt: 'VTT', txt: 'text', md: 'Markdown', json: 'JSON' }[kind];

  const body = (
    <div className="vsx-scrim" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} className="vsx" role="dialog" aria-modal="true" aria-label="Export transcript" onClick={(e) => e.stopPropagation()}>
        <div className="vsx__top">
          <div className="vsx__title">Export transcript</div>
          <button type="button" className="vsx__close" aria-label="Close" onClick={onClose}><Icon d={D.close} size={18} sw={1.8} /></button>
        </div>
        <div className="vsx__tabs"><Switch value={tab} onChange={setTab} options={TABS} size="sm" fill /></div>
        <div className="vsx__grid">
          <div className="vsx__opts">
            <p className="vsx__note">{NOTE[tab]}</p>
            {speakersTab && (
              <div className="vsx__row">
                <span className="vsx__label">Speaker labels</span>
                <Switch value={prefs.speakers[speakersTab] ?? speakerLabels ?? 'auto'} onChange={(v) => set((p) => ({ ...p, speakers: { ...p.speakers, [speakersTab]: v } }))} options={SPEAKER_LABELS} size="sm" />
              </div>
            )}
            {tsTab && (
              <div className="vsx__row">
                <span className="vsx__label">Timestamps</span>
                <Switch value={prefs.timestamps[tsTab]} onChange={(v) => set((p) => ({ ...p, timestamps: { ...p.timestamps, [tsTab]: v } }))} options={TIMESTAMPS} size="sm" />
              </div>
            )}
            {tab === 'subs' && (
              <div className="vsx__row">
                <span className="vsx__label">File type</span>
                <Switch value={prefs.subs} onChange={(v) => set((p) => ({ ...p, subs: v }))} options={[{ value: 'srt', label: 'SRT' }, { value: 'vtt', label: 'WebVTT' }]} size="sm" />
              </div>
            )}
            {tab === 'text' && (
              <div className="vsx__row">
                <span className="vsx__label">Style</span>
                <Switch value={prefs.text} onChange={(v) => set((p) => ({ ...p, text: v }))} options={[{ value: 'txt', label: 'Plain' }, { value: 'md', label: 'Markdown' }]} size="sm" />
              </div>
            )}
            {hasSummary && (tab === 'pdf' || tab === 'text' || tab === 'json') && (
              <div className="vsx__row vsx__row--inline">
                <span className="vsx__label">Summary at the top</span>
                <Toggle checked={prefs.summary} onChange={(v) => set((p) => ({ ...p, summary: v }))} label="Summary at the top" />
              </div>
            )}
            <div className="vsx__row">
              <span className="vsx__label">Part of the recording</span>
              <div className="vsx__range">
                <label className="vsx__time">
                  <span>From</span>
                  <input className="vs-input vs-input--mono" value={fromS} placeholder="0:00" inputMode="numeric" aria-label="From" aria-invalid={(fromS.trim() !== '' && start == null) || undefined} onChange={(e) => setFromS(e.target.value)} />
                  {positionS && <button type="button" className="vsx__here" onClick={() => { const h = here(); if (h) setFromS(h); }}>Playhead</button>}
                </label>
                <label className="vsx__time">
                  <span>To</span>
                  <input className="vs-input vs-input--mono" value={toS} placeholder={dur ?? 'end'} inputMode="numeric" aria-label="To" aria-invalid={(toS.trim() !== '' && end == null) || undefined} onChange={(e) => setToS(e.target.value)} />
                  {positionS && <button type="button" className="vsx__here" onClick={() => { const h = here(); if (h) setToS(h); }}>Playhead</button>}
                </label>
              </div>
              {rangeBad
                ? <span className="vsx__err" role="alert">Write times as 12:30 or 1:02:45, with the end after the start.</span>
                : (fromS || toS) ? <button type="button" className="vsx__link" onClick={() => { setFromS(''); setToS(''); }}>Use the whole recording</button> : null}
            </div>
          </div>
          <div className={`vsx__preview vsx__preview--${tab}${stale ? ' is-stale' : ''}`} aria-live="polite">
            {tab === 'json' ? (
              <pre className="vsx-code">{`{\n  "name": "…",\n  "language": "en",\n  "durationS": ${durationS ? Math.round(durationS) : '…'},${prefs.summary && hasSummary ? '\n  "summary": "…",' : ''}${range.startS != null || range.endS != null ? `\n  "startS": ${range.startS ?? 'null'},\n  "endS": ${range.endS ?? 'null'},` : ''}\n  "segments": [\n    {\n      "start": 0.0, "end": 2.4,\n      "speaker": 0, "speakerName": "…",\n      "text": "…",\n      "confidence": 0.94,\n      "words": [{ "text": "…", "start": 0.0, "end": 0.3 }]\n    }\n  ]\n}`}</pre>
            ) : previewErr ? (
              <div className="vsx__empty">{previewErr}</div>
            ) : shown == null && !stale ? (
              <div className="vsx__empty"><Spinner size={18} color="var(--brand)" track="var(--fill-12)" /></div>
            ) : (() => {
              const src = shown ?? preview!.text;
              if (tab === 'pdf') return <PaperPreview src={src} limit={10} />;
              if (tab === 'xlsx') return <SheetPreview src={src} limit={14} />;
              if (tab === 'subs') return (
                <div className="vsx-subs">
                  <CaptionPreview src={prefs.subs === 'vtt' ? src : srtAsVtt(src)} />
                  <pre className="vsx-code">{trimmed(src, 1600)}</pre>
                </div>
              );
              return <pre className="vsx-code vsx-code--full">{src.trim() || 'No transcript yet.'}</pre>;
            })()}
          </div>
        </div>
        <div className="vsx__foot">
          {copyKind && (
            <button type="button" className="vs-btn vs-btn--ghost" disabled={busy != null || rangeBad} aria-busy={busy === 'copy' || undefined} onClick={copy}>
              {busy === 'copy' ? <Spinner size={15} color="var(--brand)" track="var(--fill-12)" /> : <Icon d={done === 'copy' ? D.check : D.copy} size={15} sw={1.7} />}
              {done === 'copy' ? 'Copied' : tab === 'subs' ? `Copy ${fileLabel}` : tab === 'text' ? 'Copy text' : 'Copy as text'}
            </button>
          )}
          <button type="button" className="vs-btn vs-btn--primary" disabled={busy != null || rangeBad} aria-busy={busy === 'download' || undefined} onClick={download}>
            {busy === 'download' ? <Spinner size={15} color="currentColor" track="transparent" /> : <Icon d={done === 'download' ? D.check : D.downloaded} size={15} sw={1.7} />}
            {done === 'download' ? 'Downloaded' : `Download ${fileLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(<div className="vsp vsp-portal" data-theme={pageTheme()}>{body}</div>, document.body);
}


function pageTheme(): 'dark' | 'light' {
  const own = document.querySelector<HTMLElement>('.vsp:not(.vsp-portal)')?.dataset.theme ?? document.documentElement.dataset.theme ?? document.body.dataset.theme;
  return own === 'light' ? 'light' : 'dark';
}
