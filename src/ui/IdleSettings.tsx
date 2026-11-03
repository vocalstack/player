import { useEffect, useMemo, useRef, useState } from 'react';
import { GrowBox, Sheet, Switch, Toggle } from '../ds/Controls';
import { D, Icon } from '../ds/Icons';
import { useLanguageList } from '../ds/LanguagePicker';
import { useLanguages } from '../data/transcript';
import { pickerLanguages, useRecentLangs } from '../data/prefs';
import { REMOVE_BG_LABEL } from '../core/background';
import { langMeta } from './shared';

export interface IdlePrefs {
  lang: string | null;
  subtitles: boolean;
  speakerLabels: boolean;
  wordHighlight: boolean;
  translateAudio: boolean;
  voices: 'cloned' | 'synthetic';
  removeBackground: boolean;
  muted: boolean;
}

const HINT_CODES = ['es', 'fr', 'ro', 'ja', 'pt'];

export const IDLE_DEFAULTS: IdlePrefs = { lang: null, subtitles: true, speakerLabels: false, wordHighlight: true, translateAudio: true, voices: 'cloned', removeBackground: false, muted: false };

type Page = 'main' | 'lang' | 'subs' | 'audio';

export function useIdleControls(prefs: IdlePrefs, set: (p: Partial<IdlePrefs>) => void) {
  const langs = useLanguages();
  const [recent, pushRecent] = useRecentLangs();
  const [sheet, setSheet] = useState<'settings' | 'lang' | null>(null);
  const [page, setPage] = useState<Page>('main');
  const meta = langMeta(langs, prefs.lang);
  const languages = useMemo(() => pickerLanguages(langs, 'translation'), [langs]);
  const pick = (c: string | null) => { set({ lang: c }); pushRecent(c); };
  const list = useLanguageList({ open: sheet === 'lang' || (sheet === 'settings' && page === 'lang'), onClose: () => (sheet === 'lang' ? setSheet(null) : setPage('main')), value: prefs.lang, onSelect: pick, languages, none: 'As spoken', pinned: prefs.lang ? [prefs.lang] : [], recent, keepOpen: true });
  const close = () => { setSheet(null); setPage('main'); };
  const flag = prefs.lang ? <span style={{ fontSize: 19, lineHeight: 1 }}>{meta.flag}</span> : <Icon d={D.langAuto} size={19} sw={1.7} />;
  const [hint, setHint] = useState(() => { try { return sessionStorage.getItem('vsp.langHint') !== 'false'; } catch { return true; } });
  const dropHint = () => { setHint(false); try { sessionStorage.setItem('vsp.langHint', 'false'); } catch { } };
  const hintLangs = useMemo(() => HINT_CODES.map((c) => languages.find((l) => l.code === c)).filter((l): l is (typeof languages)[number] => !!l), [languages]);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [roomy, setRoomy] = useState(false);
  useEffect(() => {
    const root = tipRef.current?.closest('.gfull') ?? tipRef.current?.closest('.vsp');
    if (!root) return;
    const ro = new ResizeObserver(() => setRoomy(root.clientWidth >= 520 && root.clientHeight >= 300));
    ro.observe(root);
    return () => ro.disconnect();
  }, []);
  const hintOn = roomy && hint && !prefs.lang && sheet == null && hintLangs.length > 0;
  const [hintIdx, setHintIdx] = useState(0);
  useEffect(() => {
    if (!hintOn) return;
    const id = setInterval(() => setHintIdx((i) => i + 1), 1700);
    return () => clearInterval(id);
  }, [hintOn]);
  const hintAt = hintLangs[hintIdx % Math.max(1, hintLangs.length)];
  const openLang = () => { dropHint(); setPage('main'); setSheet('lang'); };
  const bubble = hintOn && hintAt ? (
    <div className="vsp-langhint" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="vsp-langhint__pick" onClick={openLang} aria-label="Choose a language">
        <Icon d={D.language} size={16} sw={1.5} style={{ color: 'var(--brand)', flex: 'none' }} />
        <span key={hintIdx} className="vsp-langhint__lang" style={{ animation: `vs-swap-${hintIdx % 2 ? 'a' : 'b'} .4s cubic-bezier(.2,.8,.2,1) both` }}>
          <span className="vsp-langhint__flag">{hintAt.flag}</span>
          <span className="vsp-langhint__name">{hintAt.native}</span>
        </span>
        <span className="vsp-langhint__dots">{hintLangs.map((o, i) => <span key={o.code} className={i === hintIdx % hintLangs.length ? 'is-on' : undefined} />)}</span>
        <span className="vsp-langhint__count">100+</span>
      </button>
      <button type="button" className="vsp-langhint__close" aria-label="Dismiss" onClick={dropHint}><Icon d={D.close} size={14} sw={1.6} /></button>
      <span className="vsp-langhint__arrow" />
    </div>
  ) : null;
  const chip = (
    <span ref={tipRef} className="vsp-btip" data-hint={bubble ? '' : undefined} data-tip={`Language: ${prefs.lang ? meta.label : 'As spoken'}`} data-open={sheet === 'lang' ? '' : undefined}>
      <button type="button" className="gfull__btn" aria-label={`Language: ${prefs.lang ? meta.label : 'As spoken'}`} onClick={(e) => { e.stopPropagation(); dropHint(); setPage('main'); setSheet((s) => (s === 'lang' ? null : 'lang')); }}>{flag}</button>
      {bubble}
    </span>
  );
  const chev = <Icon d={D.chevronRight} size={17} sw={1.6} style={{ flex: 'none', color: 'var(--ink-45)' }} />;
  const back = (
    <span className="vs-sheet__title" style={{ position: 'relative' }}>
      {' '}
      <button type="button" onClick={() => setPage('main')} aria-label="Back" className="vsp-idlesheet__back"><Icon d={D.chevronLeft} size={18} sw={1.8} />Back</button>
    </span>
  );
  const body = { display: 'flex', flexDirection: 'column' as const, gap: 2, paddingBottom: 14 };
  const row = (title: string, sub: string, ctl: React.ReactNode) => (
    <div className="srow"><div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">{title}</div><div className="srow__s">{sub}</div></div>{ctl}</div>
  );
  const langList = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '4px 14px 10px', background: 'var(--vs-surface-raised)' }}>{list.search}</div>
      {list.list}
    </div>
  );
  const settingsBody = page === 'lang' ? langList : page === 'subs' ? (
    <div style={body}>
      {row('Show subtitles', 'Captions over the video', <Toggle checked={prefs.subtitles} onChange={(v) => set({ subtitles: v })} label="Show subtitles" />)}
      {row('Show speaker labels', 'Who is speaking, before each line', <Toggle checked={prefs.speakerLabels} onChange={(v) => set({ speakerLabels: v })} label="Show speaker labels" />)}
      {row('Highlight words', 'Follow each word as it is spoken', <Toggle checked={prefs.wordHighlight} onChange={(v) => set({ wordHighlight: v })} label="Highlight words" />)}
    </div>
  ) : page === 'audio' ? (
    <div style={body}>
      {row('Translate audio', prefs.lang ? 'Hear the translation read aloud instead of the original speech' : 'Pick a language to hear the translation read aloud', <Toggle checked={prefs.translateAudio && !!prefs.lang} onChange={(v) => set({ translateAudio: v })} label="Translate audio" disabled={!prefs.lang} />)}
      {row('Voices', prefs.voices === 'cloned' ? 'Each speaker in their own cloned voice, where they agreed to it' : 'Synthetic voices matched to each speaker', <Switch<'synthetic' | 'cloned'> value={prefs.voices} onChange={(v) => set({ voices: v })} size="sm" options={[{ value: 'synthetic', label: 'Synthetic' }, { value: 'cloned', label: 'Cloned' }]} />)}
      {row(REMOVE_BG_LABEL, "Takes out everything that isn't speech: music, ambience and noise.", <Toggle checked={prefs.removeBackground} onChange={(v) => set({ removeBackground: v })} label={REMOVE_BG_LABEL} />)}
    </div>
  ) : (
    <div style={body}>
      <div className="srow srow--tap" role="button" onClick={() => setPage('lang')}>
        <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Language</div><div className="srow__s">{prefs.lang ? `Translated to ${meta.label}` : 'Original language'}</div></div>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{prefs.lang ? meta.flag : null}</span>{chev}
      </div>
      <div className="sdiv" />
      <div className="srow srow--tap" role="button" onClick={() => setPage('subs')}>
        <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Subtitles</div><div className="srow__s">{prefs.subtitles ? 'On · speaker labels and word highlighting' : 'Off'}</div></div>{chev}
      </div>
      <div className="sdiv" />
      <div className="srow srow--tap" role="button" onClick={() => setPage('audio')}>
        <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Audio</div><div className="srow__s">{prefs.lang && prefs.translateAudio ? `Translated, ${prefs.voices === 'cloned' ? 'cloned voices' : 'synthetic voices'}` : prefs.removeBackground ? 'Original speech, background removed' : 'Original sound'}</div></div>{chev}
      </div>
    </div>
  );
  const sheets = (
    <>
      <Sheet open={sheet === 'lang'} onClose={close} title="LANGUAGE" kind="picker" header={list.search} sticky>
        <GrowBox>{list.list}</GrowBox>
      </Sheet>
      <Sheet open={sheet === 'settings'} onClose={close} title={{ main: 'SETTINGS', lang: 'LANGUAGE', subs: 'SUBTITLES', audio: 'AUDIO' }[page]} titleNode={page === 'main' ? undefined : back} kind={page === 'main' ? 'settings' : 'settings vs-sheet--page'} sticky>
        <GrowBox>{settingsBody}</GrowBox>
      </Sheet>
    </>
  );
  return {
    chip,
    sheets,
    sheetOpen: sheet != null,
    openSettings: () => { setPage('main'); setSheet((s) => (s === 'settings' ? null : 'settings')); },
  };
}
