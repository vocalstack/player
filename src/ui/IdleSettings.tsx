import { useEffect, useMemo, useRef, useState } from 'react';
import { GrowBox, Sheet, Switch, Toggle } from '../ds/Controls';
import { D, Icon } from '../ds/Icons';
import { useLanguageList } from '../ds/LanguagePicker';
import { useLanguages } from '../data/transcript';
import { pickerLanguages, useRecentLangs } from '../data/prefs';
import { REMOVE_BG_LABEL } from '../core/background';
import { langMeta } from './shared';
import { versionLine } from '../core/playerVersion';

export interface IdlePrefs {
  lang: string | null;
  subtitles: boolean;
  speakerLabels: boolean;
  wordHighlight: boolean;
  translateAudio: boolean;
  voices: 'cloned' | 'synthetic';
  removeBackground: boolean;
  muted: boolean;
  spoken: string | null;
  speakers: 'auto' | 'on' | 'off';
}

export const CLONE_CONSENT_KEY = 'vsp.cloneConsent';
export const hasCloneConsent = () => { try { return sessionStorage.getItem(CLONE_CONSENT_KEY) === '1'; } catch { return false; } };
export const grantCloneConsent = () => { try { sessionStorage.setItem(CLONE_CONSENT_KEY, '1'); } catch { } };

export function CloneConsent({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="gfull__consent" role="dialog" aria-modal="true" aria-labelledby="vsp-consent-t" onClick={(e) => { e.stopPropagation(); onNo(); }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="gfull__consentcard" onClick={(e) => e.stopPropagation()}>
        <div id="vsp-consent-t" className="gfull__consenthead"><Icon d={D.voiceClone} size={18} sw={1.6} />Use cloned voices?</div>
        <p>A cloned voice reads each speaker's own words, translated into your language, in a copy of that speaker's voice. It never says anything they didn't say.</p>
        <p>Only turn it on if the people speaking agreed to have their voices cloned.</p>
        <div className="gfull__consentbtns">
          <button type="button" className="gfull__consentno" onClick={onNo}>Not now</button>
          <button type="button" className="gfull__consentyes" autoFocus onClick={onYes}>They agreed, use cloned voices</button>
        </div>
      </div>
    </div>
  );
}

export function CloneToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`gfull__clone${on ? ' gfull__clone--on' : ''}`} onClick={(e) => { e.stopPropagation(); onChange(!on); }}>
      <Icon d={D.voiceClone} size={15} sw={1.6} /><span>Voice cloning</span><span className="gfull__clonesw" aria-hidden="true"><i /></span>
    </button>
  );
}

const HINT_CODES = ['es', 'fr', 'ro', 'ja', 'pt'];

export const IDLE_DEFAULTS: IdlePrefs = { lang: null, subtitles: true, speakerLabels: false, wordHighlight: true, translateAudio: true, voices: 'synthetic', removeBackground: false, muted: false, spoken: null, speakers: 'off' };

type Page = 'main' | 'subs' | 'audio' | 'tx' | 'lang';

export function useIdleControls(prefs: IdlePrefs, set: (p: Partial<IdlePrefs>) => void, pre = false) {
  const langs = useLanguages();
  const [recent, pushRecent] = useRecentLangs();
  const [sheet, setSheet] = useState<'settings' | 'lang' | 'spoken' | null>(null);
  const [page, setPage] = useState<Page>('main');
  const meta = langMeta(langs, prefs.lang);
  const languages = useMemo(() => pickerLanguages(langs, 'translation'), [langs]);
  const pick = (c: string | null) => { set({ lang: c }); pushRecent(c); };
  const list = useLanguageList({ open: sheet === 'lang' || (sheet === 'settings' && page === 'lang'), onClose: () => (sheet === 'settings' ? setPage('main') : setSheet(null)), value: prefs.lang, onSelect: pick, languages, none: 'Original', pinned: prefs.lang ? [prefs.lang] : [], recent });
  const close = () => { setSheet(null); setPage('main'); };
  const spokenLangs = useMemo(() => pickerLanguages(langs, 'transcription').map((l) => ({ ...l, voice: false })), [langs]);
  const spokenMeta = langMeta(langs, prefs.spoken);
  const backToTx = () => { setPage('tx'); setSheet('settings'); };
  const spokenList = useLanguageList({ open: sheet === 'spoken', onClose: backToTx, value: prefs.spoken, onSelect: (c: string | null) => set({ spoken: c }), languages: spokenLangs, none: 'Auto detect', noneNote: 'Each segment gets its own detected language', pinned: prefs.spoken ? [prefs.spoken] : [], recent: [] });
  const setVoices = (v: 'cloned' | 'synthetic') => {
    if (v === 'synthetic') { set({ voices: 'synthetic' }); return; }
    if (hasCloneConsent()) set({ voices: 'cloned', ...(prefs.speakers === 'off' ? { speakers: 'auto' as const } : null) });
    else setAsking(true);
  };
  const grant = () => { grantCloneConsent(); setAsking(false); set({ voices: 'cloned', ...(prefs.speakers === 'off' ? { speakers: 'auto' as const } : null) }); };
  const setSpeakers = (v: 'auto' | 'on' | 'off') => set({ speakers: v, ...(v === 'off' && prefs.voices === 'cloned' ? { voices: 'synthetic' as const } : null) });
  const cloning = prefs.voices === 'cloned' && hasCloneConsent();
  const txSummary = [cloning ? 'Cloned voices' : 'Synthetic voices', prefs.spoken ? spokenMeta.label : 'Auto detect', prefs.speakers === 'off' ? 'No speaker labels' : prefs.speakers === 'on' ? 'Speaker labels' : 'Speaker labels when needed'].join(' · ');
  const flag = prefs.lang ? <span style={{ fontSize: 19, lineHeight: 1 }}>{meta.flag}</span> : <Icon d={D.langAuto} size={19} sw={1.7} />;
  const [asking, setAsking] = useState(false);
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
  const hintOn = roomy && hint && !prefs.lang && sheet == null && !asking && hintLangs.length > 0;
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
        <Icon d={D.language} size={16} sw={1.5} style={{ color: 'rgba(255,255,255,.85)', flex: 'none' }} />
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
    <span ref={tipRef} className="vsp-btip" data-hint={bubble ? '' : undefined} data-tip={`Language: ${meta.label}`} data-open={sheet === 'lang' ? '' : undefined}>
      <button type="button" className="gfull__btn" aria-label={`Language: ${meta.label}`} onClick={(e) => { e.stopPropagation(); dropHint(); setPage('main'); setSheet((s) => (s === 'lang' ? null : 'lang')); }}>{flag}</button>
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
  const txBody = (
    <div style={body} className="vsp-txopts">
      {row('Voice cloning', cloning ? 'Every speaker sounds like themselves in every language' : 'Listeners hear a generic synthetic voice', <Switch<'synthetic' | 'cloned'> value={cloning ? 'cloned' : 'synthetic'} onChange={setVoices} size="sm" options={[{ value: 'synthetic', label: 'Synthetic' }, { value: 'cloned', label: 'Cloned' }]} />)}
      <div className="sdiv" />
      {row('Spoken language', prefs.spoken ? `Everything is heard as ${spokenMeta.label}` : 'Each segment gets its own detected language', <Switch<'auto' | 'custom'> value={prefs.spoken ? 'custom' : 'auto'} onChange={(v) => (v === 'auto' ? set({ spoken: null }) : setSheet('spoken'))} size="sm" options={[{ value: 'auto', label: 'Auto detect' }, { value: 'custom', label: prefs.spoken ? `${spokenMeta.flag} ${spokenMeta.label}` : 'Custom' }]} />)}
      <div className="sdiv" />
      {row('Speaker labels', prefs.speakers === 'off' ? 'The transcript is plain text' : prefs.speakers === 'on' ? 'Each line is labelled with its speaker' : 'Labelled only when more than one person speaks', <Switch<'auto' | 'on' | 'off'> value={prefs.speakers} onChange={setSpeakers} size="sm" options={[{ value: 'auto', label: 'When needed' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />)}
    </div>
  );
  const settingsBody = page === 'lang' ? list.list : page === 'tx' ? txBody : page === 'subs' ? (
    <div style={body}>
      {row('Show subtitles', 'Captions over the video', <Toggle checked={prefs.subtitles} onChange={(v) => set({ subtitles: v })} label="Show subtitles" />)}
      {row('Show speaker labels', 'Who is speaking, before each line', <Toggle checked={prefs.speakerLabels} onChange={(v) => set({ speakerLabels: v })} label="Show speaker labels" />)}
      {row('Highlight words', 'Follow each word as it is spoken', <Toggle checked={prefs.wordHighlight} onChange={(v) => set({ wordHighlight: v })} label="Highlight words" />)}
    </div>
  ) : page === 'audio' ? (
    <div style={body}>
      {row('Translate audio', prefs.lang ? 'Hear the translation read aloud instead of the original speech' : 'Pick a language to hear the translation read aloud', <Toggle checked={prefs.translateAudio && !!prefs.lang} onChange={(v) => set({ translateAudio: v })} label="Translate audio" disabled={!prefs.lang} />)}
      {row('Voices', cloning ? 'Each speaker in their own cloned voice, where they agreed to it' : 'Synthetic voices matched to each speaker', <Switch<'synthetic' | 'cloned'> value={cloning ? 'cloned' : 'synthetic'} onChange={setVoices} size="sm" options={[{ value: 'synthetic', label: 'Synthetic' }, { value: 'cloned', label: 'Cloned' }]} />)}
      {row(REMOVE_BG_LABEL, "Takes out everything that isn't speech: music, ambience and noise.", <Toggle checked={prefs.removeBackground} onChange={(v) => set({ removeBackground: v })} label={REMOVE_BG_LABEL} />)}
    </div>
  ) : (
    <div style={body}>
      {pre && <>
        <div className="srow srow--tap" role="button" onClick={() => setPage('tx')}>
          <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Transcription</div><div className="srow__s">{txSummary}</div></div>{chev}
        </div>
        <div className="sdiv" />
      </>}
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
        <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Audio</div><div className="srow__s">{prefs.lang && prefs.translateAudio ? `Translated, ${cloning ? 'cloned voices' : 'synthetic voices'}` : prefs.removeBackground ? 'Original speech, background removed' : 'Original sound'}</div></div>{chev}
      </div>
      <div className="vsp-version" style={{ padding: '10px 10px 2px', fontSize: 10.5, letterSpacing: '.02em', color: 'var(--ink-35)' }}>{versionLine(true)}</div>
    </div>
  );
  const sheets = (
    <>
      <Sheet open={sheet === 'lang'} onClose={close} title="LANGUAGE" kind="picker" header={list.search} sticky>
        <GrowBox>{list.list}</GrowBox>
      </Sheet>
      <Sheet open={sheet === 'spoken'} onClose={backToTx} title="SPOKEN LANGUAGE" kind="picker" header={spokenList.search} sticky>
        <GrowBox>{spokenList.list}</GrowBox>
      </Sheet>
      <Sheet open={sheet === 'settings'} onClose={close} title={{ main: 'SETTINGS', subs: 'SUBTITLES', audio: 'AUDIO', tx: 'TRANSCRIPTION', lang: 'LANGUAGE' }[page]} titleNode={page === 'main' ? undefined : back} kind={page === 'main' ? 'settings' : 'settings vs-sheet--page'} header={page === 'lang' ? list.search : undefined} sticky>
        <GrowBox>{settingsBody}</GrowBox>
      </Sheet>
    </>
  );
  return {
    chip,
    sheets,
    sheetOpen: sheet != null,
    openSettings: () => { setPage('main'); setSheet((s) => (s === 'settings' ? null : 'settings')); },
    openTx: () => { setPage('tx'); setSheet('settings'); },
    txSummary,
    cloneToggle: pre ? <CloneToggle on={cloning} onChange={(on) => setVoices(on ? 'cloned' : 'synthetic')} /> : null,
    modal: asking ? <CloneConsent onYes={grant} onNo={() => setAsking(false)} /> : null,
  };
}
