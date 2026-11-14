import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { Card, GrowBox, LanguageChip, Sheet, Switch, Toggle } from '../ds/Controls';
import { D, Icon, Logo, PlayGlyph, Spinner } from '../ds/Icons';
import { mediaKind, type ReadPos } from '../core/voiceplayer';
import { audioDownloadUrl, audioSealed, backgroundAudioUrl, deliveryAudioUrl } from '../core/audio';
import { FileFollow } from './FileFollow';
import { HlsFollow } from './HlsFollow';

const NO_GAP_LIST: never[] = [];
import { EmbedFollow } from './EmbedFollow';
import { DailymotionFollow } from './DailymotionFollow';
import { VimeoFollow } from './VimeoFollow';
import { vimeoIds, stillThumb } from '../core/embeds';
import { FacebookFollow } from './FacebookFollow';
import { WistiaFollow } from './WistiaFollow';
import { VidyardFollow } from './VidyardFollow';
import { dailymotionId, hasEmbed, linkVideoFile, loomId, sourceVideoUrl, vidyardId, wistiaId } from '../core/embeds';
import { archiveSetup, archiveTarget } from '../core/archive';
import { siteOf } from '../core/sites';
import { SiteIcon } from './SiteIcon';
import { loomSetup } from '../core/loomStream';
import { displayName, useYtTitle } from '../data/title';
import { bedNote, originalSound, REMOVE_BG_LABEL, removeBgFromQuery, trackPlan, useBackgroundBed, useSeparatedTrack, withRemoveBg } from '../core/background';
import { playbackClock, useVoiceFollow } from '../core/voiceFollow';
import { versionLine } from '../core/playerVersion';
import { holdsClock, softWaitOf } from '../core/voiceWait';
import { useMediaKeys } from '../core/mediaKeys';
import { clock, dayLabel, durationLabel, lengthLabel } from '../core/format';
import { describe, useLanguages, useTranscript, type ErrorLike } from '../data/transcript';
import { strings } from '../data/i18n';
import { rows as toRows, showLabels, speakerLabel, speakerLook } from '../core/transcript';
import { downloadVoiceTrack, exportTranscript, jobLengthS, progressOf, rowStatusOf, saveUrl, saveWhenReady, segsLabel, TX_FORMATS, type TxProgress } from '../data/tx';
import { ytIdOf } from '../core/youtube';
import { subtitleShown } from '../core/readalong';
import { fromStream, spanGaps, toStream } from '../core/streamTime';
import { PlayerApiProvider, isLiveTranscription, isRtmp, useApi, useMediaToken, useSource, withMedia, type Listen, type PlayerApi, type PlayerSource as LoadedSource, type TokenSource } from '../data/context';
import { SideFrame, SidePanels, useSideTabs } from './SideColumn';
import { ExportPanel, LiveVideo, ReplayScrub, SummaryPanel, shareLink, summaryOf, TabBar, Toast, useSummaryIn, useViewportTranslation, type TabSpec } from './shared';
import { MuteButton, NO_SEEK, PAUSE_D, PLAY_D, PUB_SIDE, TxFind, TxLines, YtFollow, lineEnd, lineWords, pictureT, spokenWordOf, useDuck, useFindPull, useFlash, useTxPlayer, useTxVoice, useYtLead } from './core';
import { FullVideo, ListenerHeader, MiniPlayer, browserFull, modeOptions, setFullTarget, type PlayerPos, type PlayerTransport } from './full';
import { PlayerWait, playerWaitOf, useHeld } from './wait';
import { EndCard, type EndCardOptions } from './EndCard';
import { rememberCode, rememberedCode, type Started } from '../data/connect';
import { playIdOf, shareCodeOf } from '../core/share';
import { useDesk } from './useDesk';
import { ErrorGate, SourceGate, StartCard, useConnect, type IdleState } from './SourceGate';
import { CloneConsent, IDLE_DEFAULTS, grantCloneConsent, hasCloneConsent, type IdlePrefs } from './IdleSettings';
import { useLookup } from '../data/lookup';

export interface PlayerSettings {
  lang?: string | null;
  subtitles?: boolean;
  speakerLabels?: boolean;
  wordHighlight?: boolean;
  translateAudio?: boolean;
  voices?: 'cloned' | 'synthetic';
  removeBackground?: boolean;
}

export interface PlayerControls {
  language?: boolean;
  subtitles?: boolean;
  audio?: boolean;
  export?: boolean;
  share?: boolean;
  fullscreen?: boolean;
  settings?: boolean;
}

export interface PlaybackState {
  t: number;
  dur: number;
  playing: boolean;
  idx: number;
  seekN: number;
  lang: string | null;
  muted: boolean;
  voicePos?: (ReadPos & { sid: number }) | null;
}

export interface PlayerHandle {
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  toggleMute: () => void;
  load: (link: string, opts?: { poster?: string | null }) => void;
  clear: () => void;
}

const PLAYBACK_MS = 100;
const LIVE_BEHIND_S = 8;

export interface VocalStackPlayerProps {
  id?: string;
  src?: string;
  token?: TokenSource | null;
  baseUrl?: string | null;
  mode?: 'video' | 'transcript';
  layout?: 'embed' | 'page';
  dark?: boolean;
  desk?: boolean;
  settings?: PlayerSettings;
  initial?: PlayerSettings;
  onSettingsChange?: (s: Required<PlayerSettings>) => void;
  find?: string;
  onFindChange?: (q: string) => void;
  controls?: PlayerControls;
  autoplay?: boolean;
  startAt?: number | null;
  syncUrl?: boolean;
  endCard?: EndCardOptions | false;
  appUrl?: string;
  poster?: string | null;
  dailymotionPlayer?: string;
  voice?: string | null;
  settingsExtra?: ReactNode;
  shareUrl?: (t: number | null) => string;
  onShare?: () => void;
  onSource?: (s: LoadedSource) => void;
  onProgress?: (pct: number | null) => void;
  onError?: (e: ErrorLike) => void;
  onPlayback?: (s: PlaybackState) => void;
  compact?: boolean;
  className?: string;
}

interface Init { lang: string | null; labels: 'on' | 'off' | null; words: 'on' | 'off' | null; cc: boolean; translateAudio: boolean; clonedVoices: boolean; removeBackground: boolean; startAt: number | null }

const onOffOf = (v: boolean | undefined) => (v == null ? null : v ? 'on' : 'off');

function initialOf(p: VocalStackPlayerProps): Init {
  const q = p.syncUrl && typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const i = { ...(p.initial ?? {}), ...(p.settings ?? {}) };
  const onOff = (v: string | null | undefined) => (v === 'on' || v === 'off' ? v : null);
  const t = Number(q?.get('t'));
  return {
    lang: q?.get('lang') || i.lang || null,
    labels: onOff(q?.get('labels')) ?? onOffOf(i.speakerLabels),
    words: onOff(q?.get('words')) ?? onOffOf(i.wordHighlight),
    cc: q?.get('cc') ? q.get('cc') !== 'off' : i.subtitles ?? true,
    translateAudio: q?.get('audio') ? q.get('audio') !== 'original' : i.translateAudio ?? true,
    clonedVoices: q?.get('voices') ? q.get('voices') !== 'stock' : (i.voices ?? 'cloned') === 'cloned',
    removeBackground: q && q.get('bg') ? removeBgFromQuery(q) : i.removeBackground ?? false,
    startAt: Number.isFinite(t) && t > 0 ? t : p.startAt ?? null,
  };
}

export const VocalStackPlayer = forwardRef(function VocalStackPlayer(props: VocalStackPlayerProps, ref: Ref<PlayerHandle>) {
  const handle = useRef<Omit<PlayerHandle, 'load' | 'clear'> | null>(null);
  useImperativeHandle(ref, () => ({
    seek: (t) => handle.current?.seek(t),
    play: () => handle.current?.play(),
    toggleMute: () => handle.current?.toggleMute(),
    pause: () => handle.current?.pause(),
    toggle: () => handle.current?.toggle(),
    load: (link: string, opts?: { poster?: string | null }) => loadRef.current(link, opts),
    clear: () => clearRef.current(),
  }), []);
  const loadRef = useRef<(link: string, opts?: { poster?: string | null }) => void>(() => {});
  const clearRef = useRef<() => void>(() => {});
  const [cur, setCur] = useState<{ id: string; token: TokenSource | null | undefined; listen?: Listen | null }>({ id: playIdOf(props.id, !!props.token), token: props.token });
  useEffect(() => { setCur({ id: playIdOf(props.id, !!props.token), token: props.token }); }, [props.id, props.token, props.src]);
  const found = useLookup(props.src ?? null, props.token ?? null, props.baseUrl ?? null);
  useEffect(() => { if (found?.id) setCur({ id: found.id, token: props.token }); }, [found?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [typed, setTyped] = useState<string | null>(null);
  const [typedPoster, setTypedPoster] = useState<string | null>(null);
  const pickTyped = useCallback((l: string | null, poster: string | null = null) => { setTypedPoster(poster); setTyped(l); }, []);
  loadRef.current = (link: string, opts?: { poster?: string | null }) => { const l = link.trim(); if (!l) return; setCur({ id: '', token: props.token }); pickTyped(l, opts?.poster ?? null); };
  clearRef.current = () => { setCur({ id: '', token: props.token }); pickTyped(null); };
  const [idlePrefs, setIdlePrefs] = useState<IdlePrefs>(() => ({ ...IDLE_DEFAULTS, ...Object.fromEntries(Object.entries({ ...(props.initial ?? {}), ...(props.settings ?? {}) }).filter(([, v]) => v !== undefined)) } as IdlePrefs));
  const [touched, setTouched] = useState<Partial<IdlePrefs>>({});
  const idle: IdleState = { prefs: idlePrefs, set: (p) => { setIdlePrefs((x) => ({ ...x, ...p })); setTouched((x) => ({ ...x, ...p })); }, shareUrl: props.shareUrl?.(null) };
  const { muted: idleMuted, spoken: _spoken, speakers: _speakers, ...idleChosen } = touched;
  useEffect(() => { setTyped(null); }, [props.id, props.src]);
  const gateSrc = props.src ?? typed;
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const gate = !cur.id && !!gateSrc && codeFor === gateSrc && (typed != null || found !== undefined);
  const empty = !cur.id && !props.src && !typed;
  const base = useApi({ id: cur.id, token: cur.token, baseUrl: props.baseUrl, listen: cur.listen });
  useEffect(() => {
    if (cur.id || !gateSrc) { setCodeFor(null); return; }
    const own = shareCodeOf(gateSrc);
    const kept = own ? null : rememberedCode(gateSrc);
    let live = true;
    setCodeFor(null);
    const tryCode = (code: string) => base.client.shareLinks.open(code).then(() => true, () => false);
    void (async () => {
      if (own && await tryCode(own)) { if (live) setCur({ id: own, token: null }); return; }
      if (kept) {
        if (await tryCode(kept)) { if (live) setCur({ id: kept, token: null }); return; }
        rememberCode(gateSrc, null);
      }
      if (live) setCodeFor(gateSrc);
    })();
    return () => { live = false; };
  }, [gateSrc, cur.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { source, gone, error, reload } = useSource(base, cur.id);
  const media = useMediaToken(base, source?.transcription.id ?? null);
  const api = useMemo(() => withMedia(base, media), [base, media]);
  useEffect(() => { if (source) props.onSource?.(source); }, [source]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (error) props.onError?.(error); }, [error]); // eslint-disable-line react-hooks/exhaustive-deps
  const desk = useDesk(props.desk);
  const embed = (props.layout ?? 'embed') === 'embed';
  const appUrl = props.appUrl ?? (props.endCard ? props.endCard.appUrl : undefined);
  const srcRef = useRef<string | null>(null);
  srcRef.current = gateSrc ?? null;
  const onReady = useCallback((st: Started) => {
    if (st.shareCode && srcRef.current) rememberCode(srcRef.current, st.shareCode);
    setCur({ id: st.transcriptionId, token: null, listen: { transcriptionId: st.transcriptionId, token: st.token } });
  }, []);
  const connect = useConnect(appUrl, onReady);
  const clearErr = connect.clear;
  useEffect(() => { clearErr(); }, [props.id, props.src, typed, cur.id, clearErr]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFullTarget(embed ? root.current : null);
    return () => setFullTarget(null);
  }, [embed]);
  return (
    <PlayerApiProvider value={api}>
      <div ref={root} className={`vsp${embed ? ' vsp--embed' : ''}${props.className ? ` ${props.className}` : ''}`} data-theme={(props.mode ?? 'video') === 'video' || props.dark ? 'dark' : 'light'} data-mode={(props.mode ?? 'video') === 'video' ? 'video' : 'transcript'}>
        {empty ? <StartCard idle={idle} connect={connect} page={!embed} poster={props.poster ?? null} onPick={(l) => pickTyped(l)} onShare={async (code) => { try { await base.client.shareLinks.open(code); setCur({ id: code, token: null }); return true; } catch { return false; } }} /> : gate ? <SourceGate idle={idle} src={gateSrc!} ask={!typed} connect={connect} page={!embed} poster={props.poster ?? (typed ? typedPoster : null)} onClear={typed ? () => pickTyped(null) : undefined} /> : !cur.id ? <div className="vsp-gate" data-theme="dark"><span className="gfull__spin gfull__holdspin" aria-label="Loading" /></div> : error && !source ? <ErrorGate idle={idle} message={error.message} onRetry={reload} page={!embed} /> : <PlayerBody key={cur.id} {...props} poster={props.poster ?? typedPoster} initial={{ ...(props.initial ?? {}), ...idleChosen }} startMuted={idleMuted === true} handle={handle} id={cur.id} api={api} shared={source} gone={gone} loadError={error} reread={reload} desk={desk} dark={(props.mode ?? 'video') === 'video' || !!props.dark} onStarted={(st) => setCur({ id: st.transcriptionId, token: null, listen: { transcriptionId: st.transcriptionId, token: st.token } })} />}
      </div>
    </PlayerApiProvider>
  );
});


type PubTab = 'summary' | 'export';

function PlayerBody(props: VocalStackPlayerProps & { startMuted?: boolean; handle: { current: Omit<PlayerHandle, 'load' | 'clear'> | null }; api: PlayerApi; shared: LoadedSource | null; gone: boolean; loadError: ErrorLike | null; reread: () => void; desk: boolean; dark: boolean; onStarted: (s: Started) => void }) {
  const { api, shared, gone, desk, dark } = props;
  const code = props.id ?? "";
  const init = useMemo(() => initialOf(props), []); // eslint-disable-line react-hooks/exhaustive-deps
  const wantVideo = (props.mode ?? 'video') === 'video';
  const locked = wantVideo;
  const [error, setError] = useState<ErrorLike | null>(props.loadError);
  useEffect(() => { if (props.loadError) setError(props.loadError); }, [props.loadError]);
  const [tab, setTab] = useState<PubTab | 'none'>('none');
  const [find, setFind] = useState(!!props.find);
  const [findQ, setFindQ] = useState(props.find ?? '');
  const onFindChange = useRef(props.onFindChange); onFindChange.current = props.onFindChange;
  const findSeen = useRef(findQ);
  useEffect(() => { const q = find ? findQ : ''; if (q === findSeen.current) return; findSeen.current = q; onFindChange.current?.(q); }, [find, findQ]);
  const [flash, doFlash] = useFlash();
  const [live, setLive] = useState<TxProgress | null>(null);
  const [mode, setMode] = useState<'read' | 'listen'>(locked ? 'listen' : 'read');
  const [settings, setSettings] = useState(false);
  const subLangRef = useRef<string | null>(null);
  const trSeen = useRef(new Map<string, string>());
  const [page, setPageRaw] = useState<'main' | 'subs' | 'audio' | 'export'>('main');
  const setPage = (next: 'main' | 'subs' | 'audio' | 'export') => {
    const el = document.querySelector<HTMLElement>('.vs-sheet--settings');
    const scrim = el?.parentElement;
    if (el && scrim && page === 'main' && next !== 'main') scrim.style.setProperty('--vs-sheet-top', `${Math.round(el.getBoundingClientRect().top - scrim.getBoundingClientRect().top)}px`);
    setPageRaw(next);
  };
  useEffect(() => { if (!settings) setPage('main'); }, [settings]);
  const [full, setFull] = useState(locked);
  const txn = shared?.transcription ?? null;
  const transcriptionId = txn?.id ?? null;
  const [txLang, setTxLang] = useState<string | null | undefined>(init.lang);
  const askLang = typeof txLang === 'string' ? txLang : null;
  const [labelsPref, setLabelsPref] = useState<'on' | 'off' | null>(init.labels);
  const [wordsPref, setWordsPref] = useState<'on' | 'off' | null>(init.words);
  const [ccOn, setCcOn] = useState(init.cc);
  const [speakOn, setSpeakOn] = useState(init.translateAudio);
  const [cloneOn, setCloneOn] = useState(init.clonedVoices);
  const [consent, setConsent] = useState(hasCloneConsent);
  const [askConsent, setAskConsent] = useState(false);
  const [clonedTx, setClonedTx] = useState<string | null>(null);
  const hostCloned = !!transcriptionId && clonedTx === transcriptionId;
  const cloning = cloneOn && (consent || hostCloned);
  const wantClone = (on: boolean) => { if (!on) { setCloneOn(false); return; } if (consent || hostCloned) setCloneOn(true); else setAskConsent(true); };
  const grantClone = () => { setConsent(true); grantCloneConsent(); setCloneOn(true); setAskConsent(false); };
  const [removeBg, setRemoveBg] = useState(init.removeBackground);
  const fixed = props.settings;
  useEffect(() => { if (fixed?.lang !== undefined) setTxLang(fixed.lang); }, [fixed?.lang]);
  useEffect(() => { if (fixed?.speakerLabels !== undefined) setLabelsPref(fixed.speakerLabels ? 'on' : 'off'); }, [fixed?.speakerLabels]);
  useEffect(() => { if (fixed?.wordHighlight !== undefined) setWordsPref(fixed.wordHighlight ? 'on' : 'off'); }, [fixed?.wordHighlight]);
  useEffect(() => { if (fixed?.subtitles !== undefined) setCcOn(fixed.subtitles); }, [fixed?.subtitles]);
  useEffect(() => { if (fixed?.translateAudio !== undefined) setSpeakOn(fixed.translateAudio); }, [fixed?.translateAudio]);
  useEffect(() => { if (fixed?.voices !== undefined) setCloneOn(fixed.voices === 'cloned'); }, [fixed?.voices]);
  useEffect(() => { if (fixed?.removeBackground !== undefined) setRemoveBg(fixed.removeBackground); }, [fixed?.removeBackground]);
  const ctl = { language: true, subtitles: true, audio: true, export: true, share: true, fullscreen: true, settings: true, ...(props.controls ?? {}) };
  const hearOriginal = locked && !speakOn;
  useEffect(() => {
    if (!props.syncUrl) return;
    const u = new URL(window.location.href);
    if (askLang) u.searchParams.set('lang', askLang); else u.searchParams.delete('lang');
    if (labelsPref) u.searchParams.set('labels', labelsPref); else u.searchParams.delete('labels');
    if (wordsPref) u.searchParams.set('words', wordsPref); else u.searchParams.delete('words');
    if (ccOn) u.searchParams.delete('cc'); else u.searchParams.set('cc', 'off');
    if (speakOn) u.searchParams.delete('audio'); else u.searchParams.set('audio', 'original');
    if (cloneOn) u.searchParams.delete('voices'); else u.searchParams.set('voices', 'stock');
    withRemoveBg(u, removeBg);
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u);
  }, [askLang, labelsPref, wordsPref, ccOn, speakOn, cloneOn, removeBg]);
  useEffect(() => { if (shared && !shared.allowTranslate && askLang) setTxLang(null); }, [shared, askLang]);
  const { model, loading: txLoading, error: subError, clearError, setLanguage, mergeTranslations, translating, translateFailed, shownLang } = useTranscript(transcriptionId, {
    lang: null,
    onFrame: (f) => { if (f.type === 'job.progress') setLive({ state: f.state, processedS: f.processedS ?? 0, totalS: f.totalS ?? null, segmentsDone: f.segmentsDone ?? 0, segmentsTotal: f.segmentsTotal ?? null, pct: f.pct ?? 0, error: f.error ?? null }); },
  });
  const rows = useMemo(() => toRows(model), [model]);
  const known = progressOf(shared?.job ?? null);
  const settled = ['done', 'failed', 'stopped'].includes(rowStatusOf(known?.state ?? shared?.job?.state));
  const progress = settled ? known : (live ?? known);
  const liveMoving = !!live && !['done', 'failed', 'stopped'].includes(rowStatusOf(live.state));
  const reread = useRef(0);
  useEffect(() => {
    if (!settled || !liveMoving || Date.now() - reread.current < 10_000) return;
    reread.current = Date.now();
    props.reread();
  }, [settled, liveMoving, live?.state, live?.processedS, code]);
  const liveTx = !!txn?.live;
  const txLive = liveTx && isLiveTranscription(txn) && !['ended', 'processing', 'finalized'].includes(model.state);
  const wasLive = useRef(txLive);
  useEffect(() => { if (wasLive.current && !txLive) props.reread(); wasLive.current = txLive; }, [txLive]); // eslint-disable-line react-hooks/exhaustive-deps
  const status = liveTx ? (txLive ? 'transcribing' : 'done') : rowStatusOf(progress?.state ?? shared?.job?.state ?? (api.listen ? (txn?.state === 'finalized' ? 'done' : txn?.state ? 'transcribing' : undefined) : undefined));
  const running = !!transcriptionId && (status === 'transcribing' || status === 'queued');
  const holding = locked && !gone && (!shared || (!txLive && (running || status === 'cropping') && rows.length === 0));
  const pct = running ? (progress?.pct ?? 0) : 100;
  const lastRow = rows[rows.length - 1];
  const doneTo = lastRow ? lastRow.words[lastRow.words.length - 1]?.end ?? lastRow.start : 0;
  const lenS = txLive ? (doneTo || null) : jobLengthS(shared?.job, progress) ?? txn?.durationS ?? null;
  const langCode = model.segments.values().next().value?.language ?? txn?.spokenLanguage ?? null;
  const by = shared?.sharedBy ? `Shared by ${shared.sharedBy}` : '';
  const srcName = shared?.job?.source?.name?.trim() || null;
  const pageTitle = shared ? (shared.name?.trim() || srcName) : null;
  const hasAudio = !!shared?.job?.hasAudio;
  const src = shared?.job?.source;
  const sourceAudio = !hasAudio && !!src && (src.kind !== 'url' || src.bytes != null) && (status === 'transcribing' || status === 'queued' || status === 'done');
  const deliveryUrl = transcriptionId && shared?.allowDownload && hasAudio ? deliveryAudioUrl(api.origin, transcriptionId, api.cred) : null;
  const sourceStored = !!src && (src.kind !== 'url' || src.bytes != null);
  const probeSealed = sourceStored || liveTx;
  const sealed = useSealed(deliveryUrl && probeSealed ? deliveryUrl : null);
  const audioUrl = deliveryUrl && (!probeSealed || sealed === 'yes') ? deliveryUrl
    : deliveryUrl && (sealed === 'unknown' || liveTx) ? null
    : transcriptionId && shared?.allowDownload && (sourceAudio || (hasAudio && sourceStored)) ? audioDownloadUrl(api.origin, transcriptionId, 'source', api.cred) : null;
  const edgeS = locked && running && !(txLive && rows.length === 0) ? Math.max(doneTo, progress?.processedS ?? 0) : null;
  const audioPlayer = useTxPlayer(audioUrl, (hasAudio || sourceAudio) && !!shared?.allowDownload, rows, lenS, sourceAudio ? shared?.job?.crop?.startS ?? 0 : 0, edgeS);
  const srcVideoUrl = sourceVideoUrl(shared?.job?.source as Parameters<typeof sourceVideoUrl>[0]);
  const ytId = srcVideoUrl && siteOf(srcVideoUrl)?.id === 'youtube' ? ytIdOf(srcVideoUrl) : null;
  const [ownGone, setOwnGone] = useState(false);
  const ownLive = !ytId && locked && liveTx && !!transcriptionId && !!shared?.allowDownload && isRtmp(src?.kind === 'url' ? src.url : null) && !ownGone && !audioUrl;
  const videoLed = (!!ytId || ownLive) && !audioUrl;
  const ytTitle = useYtTitle(ytId);
  const gaps = useMemo(() => (liveTx ? spanGaps(model.spans) : []), [liveTx, model.spans]);
  const txStartMs = liveTx && txn?.startedAt ? Date.parse(txn.startedAt) : NaN;
  const txMediaMs = liveTx ? Date.parse(txn?.ingest?.mediaAt ?? '') : NaN;
  const yt = useYtLead(rows, lenS, ownLive ? 0 : shared?.job?.crop?.startS ?? 0, edgeS, ownLive ? NO_GAP_LIST : gaps, ownLive ? null : Number.isFinite(txStartMs) ? txStartMs : null, ownLive ? null : Number.isFinite(txMediaMs) ? txMediaMs : null, ownLive ? false : txLive);
  const clockReads = useRef(0);
  useEffect(() => {
    if (!ytId || !txLive || (Number.isFinite(txStartMs) && Number.isFinite(txMediaMs)) || clockReads.current >= 100) return;
    const h = window.setTimeout(() => { clockReads.current += 1; props.reread(); }, 3000);
    return () => window.clearTimeout(h);
  }, [ytId, txLive, txStartMs, txMediaMs, shared]); // eslint-disable-line react-hooks/exhaustive-deps
  const srcPlayer = videoLed ? yt.player : audioPlayer;
  const clockKind = playbackClock(videoLed, !!audioUrl && audioPlayer.has);
  const timeline = clockKind !== 'clips';
  const langs = useLanguages();
  const [speechState, setSpeechState] = useState<'off' | 'making' | 'ready' | 'unavailable'>('off');
  const speechUrl = locked && removeBg && !!shared?.allowDownload && !!transcriptionId && (!running || !!audioUrl) ? backgroundAudioUrl(api.origin, transcriptionId, api.cred, 'speech') : null;
  const origBySpeech = !!speechUrl && originalSound(removeBg, speechState) === 'speech';
  const langBusyRef = useRef<string | null>(null);
  const voice = useTxVoice({ transcriptionId, model, rows, lenS, ended: !!transcriptionId && !running, cred: api.cred, langs, srcLang: langCode, canTranslate: !!shared?.allowTranslate, pickedLang: txLang, setPickedLang: setTxLang, side: desk && !full ? PUB_SIDE : undefined, hearOriginal, timed: videoLed || !!audioUrl, stockVoices: locked && !cloning, consent: cloning, cloneIfOffered: cloneOn, stickyPicker: locked, pickerBusy: langBusyRef.current, originalSrc: origBySpeech ? speechUrl : audioUrl, originalOffset: !origBySpeech && sourceAudio ? shared?.job?.crop?.startS ?? 0 : 0 });
  useEffect(() => { if (voice.hasClone && transcriptionId) setClonedTx(transcriptionId); }, [voice.hasClone, transcriptionId]);
  const langSent = useRef<string | null>(null);
  useEffect(() => { if (!transcriptionId || langSent.current === askLang) return; langSent.current = askLang; setLanguage(askLang); }, [askLang, transcriptionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [onVoice, setOnVoice] = useState(false);
  const wantPlay = useRef(false);
  const rowAt = Math.max(0, onVoice ? voice.player.idx : srcPlayer.idx);
  const voiceLate = voice.on && srcPlayer.has && !timeline && (!voice.clipsReady || !voice.plays(rows[rowAt]?.sentenceId));
  useEffect(() => {
    if (!voice.on || timeline) { if (onVoice) setOnVoice(false); return; }
    if (voiceLate && onVoice) {
      voice.player.pause();
      if (wantPlay.current) srcPlayer.playRow(rowAt); else srcPlayer.seekRow(rowAt);
      setOnVoice(false);
    } else if (!voiceLate && !onVoice) {
      srcPlayer.pause();
      if (wantPlay.current) voice.player.playRow(rowAt); else voice.player.seekRow(rowAt);
      setOnVoice(true);
    }
  }, [voiceLate, onVoice, voice.on, timeline]); // eslint-disable-line react-hooks/exhaustive-deps
  const player = timeline ? srcPlayer : voice.on && onVoice && !voiceLate ? voice.player : srcPlayer;
  const handing = voice.on && !timeline && voiceLate === onVoice;
  useEffect(() => { if (player.playing) wantPlay.current = true; }, [player.playing]);
  useEffect(() => {
    if (videoLed) return;
    if (player !== srcPlayer && srcPlayer.playing) srcPlayer.pause();
    if (player !== voice.player && voice.player.playing) voice.player.pause();
  });
  useEffect(() => { if (!voiceLate) return; const id = rows[rowAt]?.sentenceId; if (id != null) voice.nearRow(id); }, [voiceLate, rowAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (timeline) { voice.player.pause(); return; } (voice.on ? srcPlayer : voice.player).pause(); }, [voice.on, timeline]); // eslint-disable-line react-hooks/exhaustive-deps
  const followLines = useMemo(() => rows.filter((r) => r.sentenceId != null).map((r, i, a) => ({ sid: r.sentenceId as number, start: r.start, end: a[i + 1]?.start ?? lineEnd(r, r.start, r.start + 4), words: r.words.map((w) => ({ start: w.start, end: w.end, text: w.text })) })), [rows]);
  const follow = useVoiceFollow({ on: timeline && voice.on, lines: followLines, clips: voice.clips, t: player.t, playing: player.playing && !player.settling, muted: player.muted, times: voice.wordTimes, original: voice.originalIds, atEnd: !player.playing && player.dur > 0 && player.t >= player.dur - 0.25 });
  const heardAt = timeline && voice.on && follow.pos && follow.pos.sid === rows[player.idx]?.sentenceId ? follow.pos : null;
  const shown = heardAt ? { ...player, voicePos: heardAt } : player;
  const langBusy = !!askLang && (translating || voice.relang || (voice.on && follow.missing != null));
  langBusyRef.current = langBusy ? askLang : null;
  useEffect(() => { if (timeline && voice.on && follow.sid != null) voice.setNear(follow.sid); }, [follow.sid, timeline, voice.on]); // eslint-disable-line react-hooks/exhaustive-deps
  const [startHold, setStartHold] = useState(false);
  useDuck([srcPlayer, voice.player], voice.sampling);
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (running && !player.playing && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [running, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = displayName({ name: shared?.name, sourceName: shared?.job?.source?.name, ytTitle, url: shared?.job?.source?.kind === 'url' ? shared.job.source.url : props.src ?? null, id: code });
  const canDownload = !!shared?.allowDownload;
  const canExport = !!shared?.allowExport;
  const dlLang = voice.readLang;
  const dlLangName = dlLang ? (langs?.languages.find((l) => l.code === dlLang)?.name ?? dlLang.toUpperCase()) : null;
  const download = async () => {
    if (!transcriptionId) return;
    try {
      if (dlLang && voice.canSpeak) {
        doFlash(`Preparing ${name} in ${dlLangName}${voice.readVoiceName ? `, read by ${voice.readVoiceName}` : ''} — the download starts when it is ready.`);
        await downloadVoiceTrack(api, { transcriptionId, lang: dlLang, voiceKey: voice.readVoiceKey, cred: api.cred, request: voice.requestTrack });
        doFlash(`Downloading ${name} in ${dlLangName}.`);
        return;
      }
      if (hasAudio) {
        doFlash(`Preparing ${name} as MP3 — the download starts when it is ready.`);
        await saveWhenReady(audioDownloadUrl(api.origin, transcriptionId, 'delivery', api.cred));
        doFlash(`Downloading ${name}.`);
        return;
      }
      saveUrl(audioDownloadUrl(api.origin, transcriptionId, 'source', api.cred));
      doFlash(`Downloading ${name} — the full audio, since the transcript is still being written.`);
    } catch (e) {
      setError(describe(e));
      throw e;
    }
  };
  const doExport = (key: typeof TX_FORMATS[number]['key']) => {
    if (!transcriptionId) return;
    const fmt = TX_FORMATS.find((f) => f.key === key)!.name;
    const inLang = dlLangName ? ` in ${dlLangName}` : '';
    return exportTranscript(api, transcriptionId, key, { lang: dlLang }).then(() => doFlash(running ? `${fmt} exported${inLang} for the first ${rows.length} segments — the rest is still transcribing.` : `${fmt} exported${inLang}.`)).catch((e) => { setError(describe(e)); throw e; });
  };
  const tail = running ? 'MORE TO COME…' : 'END OF TRANSCRIPT';
  const tailFg = running ? 'var(--brand)' : 'var(--ink-28)';
  const segs = segsLabel(progress, rows.length);
  const noSpeech = voice.on && !voice.relang && !timeline && !srcPlayer.has && !voice.clipsReady;
  const playable = (player.has && (!voice.relang || timeline)) || noSpeech;
  const playerRef = useRef(player); playerRef.current = player;
  const heardRef = useRef<(ReadPos & { sid: number }) | null>(null); heardRef.current = heardAt;
  const placeKey = `${askLang ?? ''}|${voice.on ? 'voice' : 'source'}`;
  const placeRef = useRef({ key: placeKey, idx: 0, t: 0, playing: false, until: 0 });
  useEffect(() => {
    const at = placeRef.current;
    if (at.key !== placeKey) { at.key = placeKey; at.until = Date.now() + 15000; }
    if (videoLed) return;
    if (!at.until) { at.idx = player.idx; at.t = player.t; at.playing = player.playing; return; }
    if (Date.now() > at.until) { at.until = 0; return; }
    if (!player.has || voice.relang) return;
    at.until = 0;
    if (Math.abs(player.t - at.t) > 0.5) { if (player.seekFrac && player.dur > 0) player.seekFrac(at.t / player.dur); else player.seekRow(at.idx); }
    if (at.playing && !player.playing && mode === 'listen') { autoplayDone.current = true; player.toggle(); }
  });
  const autoplayed = useRef(false);
  const autoplayDone = useRef(false);
  if (locked) mediaKind.video = true;
  const [soundTip, setSoundTip] = useState(false);
  const [adOn, setAdOn] = useState(false);
  useEffect(() => {
    if (!locked || autoplayed.current || !playable || !full || holding || handing || props.autoplay === false || (txLive && rows.length === 0)) return;
    autoplayed.current = true;
    wantPlay.current = true;
    toLive();
    const tryPlay = (n: number) => { if (playerRef.current.playing || autoplayDone.current) return; playerRef.current.toggle(); if (n > 0) setTimeout(() => tryPlay(n - 1), 1500); };
    const muted = () => { if (!playerRef.current.muted) playerRef.current.toggleMute(); setSoundTip(true); tryPlay(3); };
    const p = playerRef.current;
    const allowed = typeof navigator !== 'undefined' && !!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
    if (props.startMuted) { muted(); return; }
    if (allowed) { if (p.muted) p.toggleMute(); tryPlay(3); return; }
    if (!p.autoplay) { muted(); return; }
    void p.autoplay().then((sound) => { if (sound === false) setSoundTip(true); else if (sound == null && !autoplayDone.current) muted(); });
  }, [locked, playable, full, holding, handing, txLive && rows.length > 0, props.autoplay]);
  const unmutedNow = useRef(false);
  const soundOn = () => { if (!soundTip) return; setSoundTip(false); unmutedNow.current = true; setTimeout(() => { unmutedNow.current = false; }, 500); if (playerRef.current.muted) playerRef.current.toggleMute(); };
  const toggleSound = () => { if (unmutedNow.current) { unmutedNow.current = false; return; } setSoundTip(false); playerRef.current.toggleMute(); };
  const toLive = () => { const p = playerRef.current; if (txLive && rows.length && !p.playing && (p.t <= 0 || p.t >= doneTo - 1)) startSeek(Math.max(0, doneTo - LIVE_BEHIND_S)); };
  const tapPicture = () => { if (unmutedNow.current) { unmutedNow.current = false; return; } toLive(); autoplayDone.current = true; wantPlay.current = !playerRef.current.playing; playerRef.current.toggle(); };
  const mute = (size: number) => <MuteButton player={player} size={size} />;
  const sumOn = !!transcriptionId && !running;
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (!translating) { setWarm(false); return; }
    const t = setTimeout(() => setWarm(true), 180);
    return () => clearTimeout(t);
  }, [translating]);
  const feedLang = warm ? shownLang : askLang;
  const findHits = useFindPull(feedRef, rows, find, findQ, setFind, feedLang);
  const findField = <TxFind open={find} q={findQ} onQ={setFindQ} onClose={() => setFind(false)} hits={findHits} desk={desk} inline={desk} />;
  const onVisible = useViewportTranslation(transcriptionId, askLang, rows, mergeTranslations);
  const sharedSummary = useSummaryIn(summaryOf(txn), transcriptionId, voice.readLang);
  const anyExport = canDownload || canExport;
  const ytAt = toStream(pictureT(player, rows), yt.offset, gaps);
  const listening = mode === 'listen';
  const watching = listening && (!!ytId || locked);
  const pickMode = (m: 'read' | 'listen') => { srcPlayer.pause(); voice.player.pause(); setMode(m); if (m === 'read' && full) { browserFull(false); setFull(false); } };
  useEffect(() => { if (listening) return; if (srcPlayer.playing) srcPlayer.pause(); if (voice.player.playing) voice.player.pause(); }, [listening, srcPlayer.playing, voice.player.playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const meta = voice.barChip;
  const t = strings(meta.label);
  const modeSwitch = <Switch<'read' | 'listen'> value={mode} onChange={pickMode} bordered={false} options={modeOptions(t, !!ytId)} />;
  const tabs: TabSpec<PubTab>[] = [...(sumOn ? [{ key: 'summary' as const, label: 'Summary' }] : []), ...(anyExport ? [{ key: 'export' as const, label: 'Export' }] : [])];
  const pubPanel = (k: PubTab) => (
    <>
      {k === 'summary' && sumOn && <SummaryPanel s={sharedSummary} />}
      {k === 'export' && <ExportPanel audio={canDownload ? { name, meta: (dlLang && voice.canSpeak) || hasAudio ? `MP3${lenS ? ` · ${clock(lenS)}` : ''}` : 'ORIGINAL AUDIO', onClick: download } : null} formats={canExport} onExport={doExport} />}
    </>
  );
  const scrub = (deskStep: boolean) => (
    <ReplayScrub index={player.idx} total={Math.max(1, rows.length)} frac={player.dur > 0 ? Math.min(1, player.t / player.dur) : 0} glideMs={player.wordSync ? 0 : 220} atLabel={clock(player.t)} durLabel={clock(player.dur)} stepLabel={deskStep ? `${player.idx + 1} / ${rows.length}` : ''} onSeek={voice.relang ? NO_SEEK : player.seekRow} onSeekFrac={voice.relang ? undefined : player.seekFrac} onScrubStart={player.hold} onScrubEnd={player.release} />
  );
  const pos: PlayerPos = {
    live: txLive, atEdge: txLive && player.t >= doneTo - LIVE_BEHIND_S - 4, edgeFrac: null, readyFrac: !txLive && edgeS != null && player.dur > 0 ? Math.min(1, edgeS / player.dur) : null,
    pct: player.dur > 0 ? Math.min(100, Math.round((player.t / player.dur) * 1000) / 10) : 0,
    atLabel: clock(player.t), labelAt: (f) => clock(f * player.dur), endLabel: txLive ? 'LIVE' : clock(player.dur),
    onSeek: (f) => { if (voice.relang) return; if (txLive && f >= 0.98) startSeek(Math.max(0, doneTo - LIVE_BEHIND_S)); else player.seekFrac?.(f); },
  };
  const [slowLine, lineSince] = useHeld(voice.on && !!player.preparing && player.playing, 1500);
  const voiceFailed = voice.on && (player.error?.code === 'voice_not_started' || (timeline && follow.failed));
  const speakAvail = voice.canSpeak && !voice.error && !voiceFailed;
  const waitLangName = askLang ? (langs?.languages.find((l) => l.code === askLang)?.name ?? meta.label) : '';
  const waitState = full ? playerWaitOf({ lang: askLang, langName: waitLangName, translating: translating && !!askLang, translateFailed, voiceFailed, relang: voice.relang, starting: voice.on ? (timeline ? follow.starting : player.starting) : null, slowLine, lineSince }) : null;
  const softWait = softWaitOf({ videoLed, wait: waitState?.kind, relang: voice.relang });
  const clockHeld = holdsClock({ timeline, videoLed, voiceOn: voice.on, starting: follow.starting, wait: waitState?.kind, relang: voice.relang });
  useEffect(() => {
    if (clockHeld) { if (player.playing) { setStartHold(true); player.pause(); } return; }
    if (!startHold) return;
    setStartHold(false);
    if (!follow.failed && !translateFailed && !player.playing) player.toggle();
  }, [clockHeld, player.playing, follow.failed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hushed, setHushed] = useState<string | null>(null);
  const hushKey = waitLangName || 'voice';
  const hushBtn = <button type="button" className="gfull__toastx" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); setHushed(hushKey); }}><Icon d={D.close} size={12} sw={2} /></button>;
  const softNote = !softWait || !waitState ? null : waitState.kind === 'translating' ? `Translating into ${waitLangName || 'the new language'}…` : `Preparing the ${waitLangName || 'translated'} voice…`;
  const voiceHolds = !softWait && (waitState?.kind === 'voice' || waitState?.kind === 'starting');
  const originalRow = voice.on && (timeline ? follow.original : !!player.original);
  const plan = trackPlan(removeBg, voice.on, originalRow);
  const bedUrl = locked && trackPlan(removeBg, voice.on).bed && canDownload && !!transcriptionId && (!running || !!audioUrl) ? backgroundAudioUrl(api.origin, transcriptionId, api.cred) : null;
  const bed = useBackgroundBed(bedUrl, { t: pictureT(player, rows), playing: plan.bed && player.playing && !voiceHolds && !(player.timed && !!player.preparing), muted: player.muted });
  const speechTrack = useSeparatedTrack(speechUrl, { t: pictureT(player, rows), playing: plan.speech && (!voice.on || timeline) && player.playing, muted: player.muted });
  useEffect(() => { setSpeechState(speechTrack.state); }, [speechTrack.state]);
  const speechOver = !voice.on && speechTrack.on;
  const srcMuted = voice.on && timeline ? !follow.original || (removeBg && speechTrack.on) : speechOver;
  useEffect(() => { yt.setVideoSound(!(videoLed && srcMuted)); audioPlayer.silence?.(!videoLed && srcMuted); }, [srcMuted, videoLed, audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const bgState = !canDownload ? 'unavailable' : voice.on ? bed : speechTrack.state;
  const speaking = speakOn && speakAvail && !!askLang;
  const audioSummary = !speaking ? (removeBg && bgState !== 'unavailable' ? 'Original speech, background removed' : 'Original sound') : [`Translated${voice.hasClone ? (cloning ? ', cloned voices' : ', synthetic voices') : ''}`, !removeBg && canDownload && bed !== 'unavailable' ? 'with background sound' : null].filter(Boolean).join(' ');
  const waitRetry = () => { if (waitState?.kind === 'translateFailed') { setLanguage(askLang); return; } autoplayDone.current = true; player.toggle(); };
  const waitOriginal = () => { const at = player.idx; player.pause(); setTxLang(null); autoplayDone.current = true; srcPlayer.playRow(at); };
  const playBusy = (voice.relang && !ytId) || voiceHolds || (!videoLed && player.playing && !!player.preparing);
  const [playAsked, setPlayAsked] = useState(false);
  const speechLate = voice.on && !!askLang && !voice.relang && (noSpeech || voiceLate || (timeline ? follow.missing != null : !!player.silent));
  useEffect(() => { if (!speechLate) setPlayAsked(false); }, [speechLate]);
  const armedEarly = useRef(false);
  useEffect(() => {
    if (noSpeech && playAsked) { armedEarly.current = true; return; }
    if (!noSpeech && armedEarly.current) { armedEarly.current = false; if (playAsked && !player.playing) player.toggle(); }
  }, [noSpeech, playAsked]); // eslint-disable-line react-hooks/exhaustive-deps
  const playWaiting = speechLate && !playBusy && (noSpeech ? playAsked : player.playing || startHold || playAsked);
  const [playPopOff, setPlayPopOff] = useState(false);
  useEffect(() => { if (!playWaiting) setPlayPopOff(false); }, [playWaiting]);
  const pressPlay = () => {
    if (noSpeech) { setPlayAsked((a) => !a); autoplayDone.current = true; wantPlay.current = !playAsked; return; }
    if (startHold) { setStartHold(false); wantPlay.current = false; return; }
    setPlayAsked(!player.playing);
    toLive(); autoplayDone.current = true; wantPlay.current = !player.playing; player.toggle();
  };
  const transport: PlayerTransport = { prevOn: player.idx > 0, nextOn: player.idx < rows.length - 1, onPrev: player.prev, onNext: player.next, playing: player.playing || startHold, playable, playTitle: voice.playTitle ?? (player.playing || startHold ? 'Pause' : 'Play'), onPlay: pressPlay, busy: playBusy, wait: playWaiting ? { lang: waitLangName || meta.label || null, open: !playPopOff, onDismiss: () => setPlayPopOff(true) } : null };
  useMediaKeys(playable && listening ? { playing: player.playing || startHold, toggle: () => { if (startHold) { setStartHold(false); wantPlay.current = false; return; } toLive(); autoplayDone.current = true; wantPlay.current = !player.playing; player.toggle(); }, next: player.next, prev: player.prev } : null, pageTitle);
  const glassChip: React.CSSProperties = { background: 'transparent', color: '#eef0f8', width: 74, justifyContent: 'center', boxSizing: 'border-box' };
  const chipFor = (style: React.CSSProperties, size?: 'sm') => !meta.can || !ctl.language ? null : locked
    ? <button type="button" className="gfull__btn" title={langBusy ? `Language: ${meta.label ?? meta.code}, still being prepared` : `Language: ${meta.label ?? meta.code}`} aria-label={`Language: ${meta.label ?? meta.code}`} aria-busy={langBusy || undefined} onClick={() => { setSettings(false); meta.onClick(); }} style={{ position: 'relative' }}><span style={{ fontSize: size === 'sm' ? 17 : 21, lineHeight: 1 }}>{meta.flag}</span>{langBusy && <span style={{ position: 'absolute', right: 2, bottom: 2, display: 'flex', borderRadius: 999, background: 'rgba(5,6,21,.7)', padding: 1 }}><Spinner size={11} color="#eef0f8" track="rgba(255,255,255,.25)" /></span>}</button>
    : <LanguageChip flag={meta.flag} code={meta.code} label={meta.label} bordered={false} size={size} onClick={meta.onClick} style={style} />;
  const voicesBtn = { on: false, title: 'Speakers', onClick: () => {}, busy: voice.voiceWaiting || voiceHolds };
  const [posterGone, setPosterGone] = useState(false);
  const [autoWait, setAutoWait] = useState(true);
  useEffect(() => { if (!autoWait) return; const id = setTimeout(() => setAutoWait(false), 12_000); return () => clearTimeout(id); }, [autoWait]);
  useEffect(() => { if (player.playing || posterGone) setAutoWait(false); }, [player.playing, posterGone]);
  const posterSpin = videoLed && (yt.player.preparing || player.playing || (autoWait && locked && !!full && props.autoplay !== false && !autoplayDone.current));
  useEffect(() => { if (player.t > 0.3) setPosterGone(true); }, [player.t]);
  const fileVideo = !ytId && locked && transcriptionId && shared?.allowDownload && !running && shared?.job?.hasVideo !== false && (shared?.job?.source?.kind !== 'url' || isRtmp(shared.job.source.url)) ? <FileFollow key={transcriptionId} src={audioDownloadUrl(api.origin, transcriptionId, 'video', api.cred)} hls={`${audioDownloadUrl(api.origin, transcriptionId, 'video', api.cred)}&format=hls`} t={pictureT(player, rows)} playing={player.playing && !voiceHolds} seekN={player.seekN} onToggle={player.has ? tapPicture : undefined} /> : null;
  const linkFile = shared?.job?.source?.kind === 'url' ? linkVideoFile(shared.job.source.url) : null;
  const linkVideo = !ytId && locked && linkFile ? <FileFollow key={linkFile} src={linkFile} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} onToggle={player.has ? tapPicture : undefined} /> : null;
  const embedSrc = !ytId && locked && srcVideoUrl && hasEmbed(srcVideoUrl) ? srcVideoUrl : null;
  const loomVid = embedSrc ? loomId(embedSrc) : null;
  const loomFollow = useMemo(() => (loomVid ? loomSetup(loomVid) : undefined), [loomVid]);
  const fbSrc = embedSrc && siteOf(embedSrc)?.id === 'facebook' ? embedSrc : null;
  const wistia = embedSrc && siteOf(embedSrc)?.id === 'wistia' ? wistiaId(embedSrc) : null;
  const vidyard = embedSrc && siteOf(embedSrc)?.id === 'vidyard' ? vidyardId(embedSrc) : null;
  const dm = embedSrc && siteOf(embedSrc)?.id === 'dailymotion' ? dailymotionId(embedSrc) : null;
  const vm = embedSrc && siteOf(embedSrc)?.id === 'vimeo' ? vimeoIds(embedSrc) : null;
  const ia = embedSrc && siteOf(embedSrc)?.id === 'archive' ? archiveTarget(embedSrc) : null;
  const iaKey = ia ? `${ia.id}/${ia.file ?? ''}` : null;
  const iaFollow = useMemo(() => (ia ? archiveSetup(ia.id, ia.file) : undefined), [iaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const embedPic = vidyard ? <VidyardFollow key={vidyard} uuid={vidyard} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} onToggle={player.has ? tapPicture : undefined} />
    : wistia ? <WistiaFollow key={wistia} id={wistia} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} onToggle={player.has ? tapPicture : undefined} />
    : fbSrc ? <FacebookFollow key={fbSrc} url={fbSrc} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} onToggle={player.has ? tapPicture : undefined} />
    : dm ? <DailymotionFollow key={dm} video={dm} player={props.dailymotionPlayer} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} onToggle={player.has ? tapPicture : undefined} />
    : vm ? <VimeoFollow key={vm.id} id={vm.id} h={vm.h} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} title={name} onToggle={player.has ? tapPicture : undefined} />
    : iaFollow ? <FileFollow key={iaKey} setup={iaFollow} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} onToggle={player.has ? tapPicture : undefined} />
    : loomFollow ? <FileFollow key={loomVid} setup={loomFollow} seekOver={1} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} onToggle={player.has ? tapPicture : undefined} />
    : embedSrc ? <EmbedFollow url={embedSrc} t={pictureT(player, rows) + (shared?.job?.crop?.startS ?? 0)} playing={player.playing && !voiceHolds} seekN={player.seekN} title={name} onToggle={player.has ? tapPicture : undefined} /> : null;
  const baseTap = player.has ? <div className="txyt vsp-follow"><div aria-hidden="true" className="txyt__tap" onClick={tapPicture} style={{ cursor: 'pointer' }} /><div className={`txyt__paused${!player.playing ? ' txyt__paused--on' : ''}`} aria-hidden="true"><span className="txyt__pausedplay"><PlayGlyph size={44} /></span></div></div> : null;
  const thumbUrl = stillThumb((shared?.job?.source as { thumbnailUrl?: string | null } | undefined)?.thumbnailUrl ?? null);
  const failedTx = status === 'failed' && rows.length === 0;
  const thumbPic = thumbUrl && /^https:\/\//.test(thumbUrl) ? <div className={`vsp-thumbpic${(shared?.job?.source as { site?: string | null } | undefined)?.site === 'x' ? ` vsp-thumbpic--pan${player.playing ? ' vsp-thumbpic--on' : ''}` : ''}`} aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(thumbUrl)})` }} /> : null;
  const picture = !ytId ? (locked ? <><div className="vsp-idle__pic vsp-idle__pic--brand" />{thumbPic}{failedTx ? null : baseTap}<div className={failedTx ? 'vsp-pics vsp-failed' : 'vsp-pics'} style={{ display: 'contents' }}>{embedPic}{ownLive ? <HlsFollow key={transcriptionId} src={`${audioDownloadUrl(api.origin, transcriptionId!, 'video', api.cred)}&format=hls`} lead={yt.lead} onGone={() => setOwnGone(true)} onToggle={player.has ? tapPicture : undefined} /> : fileVideo}{linkVideo}</div></> : null) : <>{<YtFollow busy={videoLed && (!!yt.player.preparing || (autoWait && !player.playing && locked && !!full && props.autoplay !== false && !autoplayDone.current))} ytId={ytId} title={name} t={ytAt} playing={player.playing && !voiceHolds} waiting={voice.on && !!player.timed && !!player.preparing} seekN={player.seekN} onTime={(y) => player.videoAt?.(fromStream(y, yt.offset, gaps))} onToggle={player.has ? tapPicture : undefined} onAd={setAdOn} lead={videoLed ? yt.lead : undefined} info={yt.lead.onInfo} />}<div className="vsp-poster" aria-hidden="true" style={{ opacity: posterGone ? 0 : 1 }}><div className="vsp-poster__img" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${ytId}/hqdefault.jpg)` }} /><span className="txyt__pausedplay">{posterSpin ? <span className="gfull__spin txyt__spin" /> : <PlayGlyph size={44} />}</span></div></>;
  const video = watching && ytId && !full ? (
    <LiveVideo ytId={ytId} title={name} radius={14} large style={desk ? undefined : { margin: '8px 20px 2px' }} picture={picture}>
      <MiniPlayer pos={pos} transport={transport} chip={chipFor({ ...glassChip, width: 64, height: 28, minHeight: 28, padding: '0 8px' }, 'sm')} voices={voicesBtn} onFull={() => { browserFull(true); setFull(true); }} copied={null} />
    </LiveVideo>
  ) : null;
  const subRow = player.wordSync ? (subtitleShown(rows, player.idx, player.t) ? rows[player.idx] : undefined) : rows[player.idx];
  for (const r of rows) for (const [l, tx] of Object.entries(r.translations)) if (tx) trSeen.current.set(`${r.sentenceId ?? r.start}|${l}`, tx);
  const seenIn = (r: NonNullable<typeof subRow>, l: string) => r.translations[l] || trSeen.current.get(`${r.sentenceId ?? r.start}|${l}`) || null;
  const hasLang = (r: typeof subRow, l: string | null) => !r || !l || r.language === l || !!seenIn(r, l);
  const subLang = hasLang(subRow, askLang) ? askLang : hasLang(subRow, subLangRef.current) ? subLangRef.current : askLang;
  if (subRow && hasLang(subRow, subLang)) subLangRef.current = subLang;
  const subText = subRow && subLang && subRow.language !== subLang ? seenIn(subRow, subLang) : null;
  const subRows = subRow && subText && subLang && !subRow.translations[subLang] ? Object.assign([...rows], { [player.idx]: { ...subRow, translations: { ...subRow.translations, [subLang]: subText } } }) : rows;
  const subLine = subRow ? lineWords(subRows, player.idx, subLang) : [];
  const wordsOn = wordsPref ? wordsPref === 'on' : !locked || voice.on || !feedLang || feedLang === langCode;
  const subBy = subText ? shown : player;
  const subAt = wordsOn ? spokenWordOf(subBy, player.idx, subLine) : null;
  const subWords = subLine.map((w, j) => ({ t: w.text, sp: j < subLine.length - 1 ? ' ' : '', dim: subAt != null && j > subAt }));
  const labelsOn = labelsPref ? labelsPref === 'on' : locked ? false : showLabels(model, rows, txn?.settings);
  const settingsOut = { lang: askLang, subtitles: ccOn, speakerLabels: labelsOn, wordHighlight: wordsOn, translateAudio: speakOn, voices: cloning ? 'cloned' as const : 'synthetic' as const, removeBackground: removeBg };
  const settingsKey = JSON.stringify(settingsOut);
  const onSettings = useRef(props.onSettingsChange);
  onSettings.current = props.onSettingsChange;
  useEffect(() => { onSettings.current?.(settingsOut); }, [settingsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const subLook = subRow && subRow.speaker >= 0 && labelsOn ? speakerLook(model, subRow.speaker) : null;
  const [linkCopied, setLinkCopied] = useState(false);
  const [expBusy, setExpBusy] = useState<'srt' | 'pdf' | null>(null);
  const [expDone, setExpDone] = useState<'srt' | 'pdf' | null>(null);
  const expT = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(expT.current), []);
  const copiedT = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedT.current), []);
  const shareAtUrl = (t: number | null) => { if (props.shareUrl) return props.shareUrl(t); const u = new URL(window.location.href); if (t != null && t > 0) u.searchParams.set('t', String(t)); else u.searchParams.delete('t'); return u.href; };
  const startAt = useRef<number | null>(init.startAt);
  const startSeek = (t0: number) => {
    if (player.seekFrac && player.dur > 0) { player.seekFrac(Math.min(1, t0 / player.dur)); return; }
    let i = 0;
    for (let k = 0; k < rows.length; k++) if (rows[k].start <= t0) i = k;
    player.seekRow(i);
  };
  const startEarly = useRef(false);
  useEffect(() => {
    const t0 = startAt.current;
    if (t0 == null || startEarly.current || !player.has || rows.length === 0) return;
    startEarly.current = true;
    startSeek(t0);
  }, [player.has, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t0 = startAt.current;
    if (t0 == null || !player.playing) return;
    startAt.current = null;
    if (Math.abs(player.t - t0) > 2) startSeek(t0);
  }, [player.playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const sought = useRef(false);
  const seekTo = (t0: number) => { autoplayDone.current = true; startAt.current = null; sought.current = true; startSeek(Math.max(0, t0)); };
  const playNow = () => { const at = sought.current; sought.current = false; if (listening && !playerRef.current.playing) { if (!at) toLive(); playerRef.current.toggle(); } };
  props.handle.current = {
    seek: (t0) => seekTo(t0),
    play: () => { autoplayDone.current = true; if (sought.current) window.setTimeout(playNow, 0); else playNow(); },
    pause: () => { autoplayDone.current = true; sought.current = false; playerRef.current.pause(); },
    toggle: () => { autoplayDone.current = true; const at = sought.current; sought.current = false; if (listening || playerRef.current.playing) { if (!at) toLive(); playerRef.current.toggle(); } },
    toggleMute: () => { setSoundTip(false); playerRef.current.toggleMute(); },
  };
  useEffect(() => () => { props.handle.current = null; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onPlayback = useRef(props.onPlayback);
  onPlayback.current = props.onPlayback;
  const playbackLang = useRef(askLang);
  playbackLang.current = askLang;
  useEffect(() => {
    let last = '';
    const tick = () => {
      const cb = onPlayback.current;
      if (!cb) return;
      const p = playerRef.current;
      const heard = heardRef.current;
      const s: PlaybackState = { t: p.t, dur: p.dur, playing: p.playing, idx: p.idx, seekN: p.seekN, lang: playbackLang.current, muted: p.muted, voicePos: heard };
      const key = `${s.t.toFixed(2)}|${s.dur}|${s.playing}|${s.idx}|${s.seekN}|${s.lang}|${s.muted}|${heard ? `${heard.t.toFixed(2)}/${heard.dur.toFixed(2)}` : ''}`;
      if (key === last) return;
      last = key;
      cb(s);
    };
    tick();
    const id = window.setInterval(tick, PLAYBACK_MS);
    return () => window.clearInterval(id);
  }, []);
  const shareHere = () => props.onShare ? props.onShare() : shareLink(shareAtUrl(null), name, () => { window.clearTimeout(copiedT.current); setLinkCopied(true); copiedT.current = window.setTimeout(() => setLinkCopied(false), 2200); });
  const exportRow = (key: 'srt' | 'pdf', title: string, sub: string) => {
    const f = TX_FORMATS.find((x) => x.key === key)!;
    const busy = expBusy === key, done = expDone === key;
    return (
      <div className="srow srow--tap" role="button" aria-busy={busy || undefined} style={expBusy && !busy ? { opacity: 0.45, pointerEvents: 'none' } : undefined} onClick={() => {
        if (expBusy) return;
        setExpBusy(key);
        Promise.resolve().then(() => doExport(key)).then(() => { setExpDone(key); window.clearTimeout(expT.current); expT.current = window.setTimeout(() => setExpDone(null), 1600); }).catch(() => {}).finally(() => setExpBusy(null));
      }}>
        {busy ? <Spinner size={17} color="var(--brand)" track="var(--fill-12)" /> : <Icon d={f.icon} size={17} sw={1.5} style={{ flex: 'none', color: 'var(--ink-70)' }} />}
        <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">{title}</div><div className="srow__s">{sub}</div></div>
        <Icon d={done ? D.check : D.downloaded} size={17} sw={1.6} style={{ flex: 'none', color: done ? 'var(--brand)' : 'var(--ink-62)' }} />
      </div>
    );
  };
  const eyebrow: React.CSSProperties = { padding: '10px 14px 4px', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', color: 'var(--ink-35)' };
  const subsBack = (
    <span className="vs-sheet__title" style={{ position: 'relative' }}>
      {'\u00a0'}
      <button type="button" onClick={() => { voice.langPage.setOpen(false); setPage('main'); }} aria-label="Back" style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', gap: 2, padding: '4px 6px 4px 0', border: 0, background: 'none', color: 'var(--ink-96)', fontFamily: 'var(--vs-font-sans)', fontSize: 15, fontWeight: 600, letterSpacing: 0, lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer' }}>
        <Icon d={D.chevronLeft} size={18} sw={1.8} />Back
      </button>
    </span>
  );
  const chev = <Icon d={D.chevronRight} size={17} sw={1.6} style={{ flex: 'none', color: 'var(--ink-45)' }} />;
  const sheetTitle = { main: 'SETTINGS', subs: 'SUBTITLES', audio: 'AUDIO', export: 'EXPORT' }[page];
  const pageBody: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 14 };
  const langOn = voice.langPage.open;
  useEffect(() => { if (!settings) voice.langPage.setOpen(false); }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const settingsSheet = locked ? (
    <Sheet open={settings} onClose={() => setSettings(false)} title={langOn ? 'LANGUAGE' : sheetTitle} titleNode={page === 'main' && !langOn ? undefined : subsBack} doneLabel={t.done} kind={page === 'main' && !langOn ? 'settings' : 'settings vs-sheet--page'} header={langOn ? voice.langPage.search : undefined} sticky>
      <GrowBox>
      {langOn ? voice.langPage.list : page === 'subs' ? (
        <div style={pageBody}>
          <div className="srow">
            <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Show subtitles</div><div className="srow__s">Captions over the video</div></div>
            <Toggle checked={ccOn} onChange={setCcOn} label="Show subtitles" />
          </div>
          <div className="srow">
            <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Show speaker labels</div><div className="srow__s">Who is speaking, before each line</div></div>
            <Toggle checked={labelsOn} onChange={(v) => setLabelsPref(v ? 'on' : 'off')} label="Show speaker labels" />
          </div>
          <div className="srow">
            <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Highlight words</div><div className="srow__s">Follow each word as it is spoken</div></div>
            <Toggle checked={wordsOn} onChange={(v) => setWordsPref(v ? 'on' : 'off')} label="Highlight words" />
          </div>
        </div>
      ) : page === 'audio' ? (
        <div style={pageBody}>
          <div className="srow">
            <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Translate audio</div><div className="srow__s">{!askLang ? 'Pick a language to hear the translation read aloud' : speakAvail ? 'Hear the translation read aloud instead of the original speech' : voice.canSpeak ? 'Not available right now' : 'Not available in this language'}</div></div>
            <Toggle checked={speaking} onChange={setSpeakOn} label="Translate audio" disabled={!speakAvail || !askLang} />
          </div>
          {speaking && voice.hasClone && (
            <div className="srow">
              <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Voices</div><div className="srow__s">{cloning ? 'Each speaker in their own cloned voice' : 'Synthetic voices matched to each speaker'}</div></div>
              <Switch<'stock' | 'clone'> value={cloning ? 'clone' : 'stock'} onChange={(v) => wantClone(v === 'clone')} size="sm" options={[{ value: 'stock', label: 'Synthetic' }, { value: 'clone', label: 'Cloned' }]} />
            </div>
          )}
          <div className="srow">
            <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">{REMOVE_BG_LABEL}</div><div className="srow__s">{bedNote(removeBg, bgState, 'video', voice.on ? 0 : speechTrack.untilS)}</div></div>
            <Toggle checked={removeBg && canDownload} onChange={setRemoveBg} label={REMOVE_BG_LABEL} disabled={!canDownload || (bgState === 'unavailable' && !removeBg)} />
          </div>
        </div>
      ) : page === 'export' ? (
        <div style={pageBody}>
          {exportRow('srt', 'Subtitles', 'SRT / VTT caption cues, ready for a video editor or a player')}
          {exportRow('pdf', 'PDF', 'Formatted transcript in paragraphs, with timestamps and speaker labels')}
        </div>
      ) : (
        <div style={pageBody}>
          {[
            meta.can && ctl.language && (
              <div key="lang" className="srow srow--tap" role="button" onClick={() => voice.langPage.setOpen(true)}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Language</div><div className="srow__s">{askLang ? `Translated to ${meta.label ?? askLang.toUpperCase()}` : 'Original language'}</div></div>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.flag}</span>
                {chev}
              </div>
            ),
            ctl.subtitles && (
              <div key="subs" className="srow srow--tap" role="button" onClick={() => setPage('subs')}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Subtitles</div><div className="srow__s">{ccOn ? 'On · speaker labels and word highlighting' : 'Off'}</div></div>
                {chev}
              </div>
            ),
            ctl.audio && (
              <div key="audio" className="srow srow--tap" role="button" onClick={() => setPage('audio')}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Audio</div><div className="srow__s">{audioSummary}</div></div>
                {chev}
              </div>
            ),
            ctl.export && canExport && !!transcriptionId && (
              <div key="export" className="srow srow--tap" role="button" onClick={() => setPage('export')}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">Export{dlLangName ? ` in ${dlLangName}` : ''}</div><div className="srow__s">Subtitles (SRT / VTT) or a PDF of the transcript</div></div>
                {chev}
              </div>
            ),
          ].filter(Boolean).flatMap((el, i) => (i ? [<div key={`d${i}`} className="sdiv" />, el] : [el]))}
          <div className="vsp-version" style={{ padding: '10px 10px 2px', fontSize: 10.5, letterSpacing: '.02em', color: 'var(--ink-35)' }}>{versionLine(true)}</div>
        </div>
      )}
      </GrowBox>
    </Sheet>
  ) : (
    <Sheet open={settings} onClose={() => setSettings(false)} title={t.settings} doneLabel={t.done} drawer={desk}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {meta.can && (
          <>
            <div className="srow srow--tap" onClick={() => { setSettings(false); meta.onClick(); }}>
              <div style={{ flex: 1, minWidth: 0 }}><div className="srow__t">{t.langLabel}</div><div className="srow__s">{t.langCount}</div></div>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.flag}</span>{voice.original ? null : <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-96)' }}>{meta.label}</span>}<Icon d={D.chevronRight} size={15} style={{ color: 'var(--ink-45)' }} />
            </div>
            <div className="sdiv" />
          </>
        )}
        {props.settingsExtra}
      </div>
    </Sheet>
  );

  const fullEl = full && watching && (!!ytId || locked) && (
    <FullVideo
      modal={askConsent ? <CloneConsent onYes={grantClone} onNo={() => setAskConsent(false)} /> : undefined}
      page={(props.layout ?? 'embed') === 'page'} picture={picture} title={name} desk={desk} pos={pos} mute={{ muted: player.muted, onToggle: toggleSound }} cc={ctl.subtitles ? { on: ccOn, onToggle: () => setCcOn((v) => !v) } : undefined} noFull={!ctl.fullscreen} ad={adOn} wait={waitState && !softWait ? <PlayerWait state={waitState} line={voiceHolds ? subWords.map((w) => w.t + w.sp).join('') : null} onRetry={waitRetry} onOriginal={waitOriginal} /> : player.edgeWait ? (txLive ? 'Catching up with the live transcript…' : `Transcribing ${Math.round(pct)}% — it plays on as more is written`) : null} pct={running && !txLive ? Math.round(pct) : null}
      sub={ccOn && subRow ? { who: subLook ? speakerLabel(model, subRow.speaker) : null, color: subLook ? subLook.fg ?? `var(--lane-${subLook.lane})` : '#fff', words: subWords, cursor: spokenWordOf(subBy, player.idx, subLine) } : null}
      chip={chipFor(desk ? glassChip : { ...glassChip, width: 64, padding: '0 6px' }, desk ? undefined : 'sm')} transport={transport}
      picker={voice.sheets} sheet={locked ? settingsSheet : null} voices={null} voicesBtn={locked ? null : voicesBtn} sheetOpen={voice.sheetsOpen || settings} onShare={locked && ctl.share ? shareHere : undefined} onSettings={locked && ctl.settings ? () => { voice.closePicker(); setSettings((v) => !v); } : undefined} compact={!!props.compact} paused={{ title: name, summary: sharedSummary.state === 'ready' ? sharedSummary.summary ?? null : null, share: ctl.share && (props.shareUrl || !props.onShare) ? { url: shareAtUrl, at: player.t } : null }}
      copied={failedTx ? <div className="gfull__toast gfull__toast--warn" role="status"><Icon d={D.warn} size={13} sw={1.9} />This video couldn't be transcribed</div> : linkCopied ? <div className="gfull__toast" aria-live="polite"><Icon d={D.check} size={13} sw={2} />Link copied</div> : soundTip ? <div className="gfull__toast gfull__soundtip" aria-live="polite"><Icon d={D.volumeOff} size={14} sw={1.8} />Tap for sound</div> : softNote && hushed !== hushKey ? <div className="gfull__toast gfull__toast--x" role="status" aria-live="polite"><Spinner size={13} color="#eef0f8" track="rgba(255,255,255,.25)" />{softNote}{hushBtn}</div> : (voiceLate || voice.on && (timeline ? follow.missing != null : player.silent)) && hushed !== hushKey && !playWaiting ? <div className="gfull__toast gfull__toast--x" role="status" aria-live="polite"><Spinner size={13} color="#eef0f8" track="rgba(255,255,255,.25)" />{`${waitLangName || 'Translated'} voice is still being prepared · playing with subtitles`}{hushBtn}</div> : null} onTouch={() => { browserFull(true); soundOn(); }} onClose={locked ? undefined : () => { browserFull(false); setFull(false); }} />
  );
  useEffect(() => { if (!locked && full && !watching) { browserFull(false); setFull(false); } }, [locked, full, watching]);
  const progressBox = running && !txLive && (
    <div className={`pubprog${desk ? ' pubprog--desk' : ''}${find ? ' pubprog--find' : ''}`}>
      <div className="pubprog__row"><span className="l">{`TRANSCRIBING ${pct}%`}</span>{!desk && <div style={{ flex: 1 }} />}{desk && <div className="pubprog__bar" style={{ flex: 1 }}><div style={{ width: `${pct}%` }} /></div>}<span className="s">{segs}</span></div>
      {!desk && <div className="pubprog__bar" style={{ marginTop: 8 }}><div style={{ width: `${pct}%` }} /></div>}
    </div>
  );
  const gonePanel = gone && <div className="hint" style={{ padding: '30px 20px', textAlign: 'center', fontSize: 13 }}>This link is no longer shared. Ask the person who sent it for a new one.</div>;
  const lines = <TxLines tapUnclear={listening} tap={listening} model={model} rows={rows} player={listening ? shown : { ...shown, playRow: player.seekRow }} tail={tail} tailFg={tailFg} loading={txLoading} running={running} desk={desk} feedRef={feedRef} listener showLabels={labelsOn} find={findQ} findOpen={!desk && find} lang={feedLang} warm={warm} onVisible={onVisible} wordHl={wordsOn} />;
  const toast = <Toast error={error ?? subError ?? (voiceFailed && full ? null : player.error) ?? voice.error} onClose={() => { setError(null); clearError(); player.clearError(); voice.clearError(); }} />;
  const langInfo = langCode ? langs?.languages.find((l) => l.code === langCode) : null;
  const langLine = langCode ? `${langInfo?.flag ? `${langInfo.flag} ` : ''}${langInfo?.name ?? langCode.toUpperCase()}` : null;
  const madeIso = txn?.startedAt ?? txn?.createdAt ?? null;
  const subline = [langLine, lenS ? lengthLabel(lenS) : null, madeIso ? dayLabel(madeIso) : null, by || 'Read-only copy'].filter(Boolean).join(' · ');
  const pubTransport = (deskScrub: boolean) => (
    <div className="ctrans">
      {voice.noVoice ? voice.noVoiceNote : (
        <>
          <div className="ctrans__row">
            <span className="ctrans__sp" aria-hidden="true" />
            <div className="ctrans__mid">
              <button type="button" className="ctrans__step" aria-label="Previous segment" title="Previous segment" style={{ opacity: player.idx <= 0 ? 0.3 : 1 }} onClick={player.prev}><Icon d={D.chevronLeft} size={16} sw={1.8} /></button>
              <button type="button" className="ctrans__play" aria-label={voice.relang ? 'Preparing audio' : player.playing ? 'Pause' : 'Play'} title={voice.relang ? 'Preparing audio…' : voice.playTitle ?? (player.playing ? 'Pause' : 'Play')} disabled={!playable} onClick={player.toggle}>
                {voice.relang
                  ? <span className="ctrans__spin" />
                  : <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true" style={player.playing ? undefined : { marginLeft: 2 }}>{player.playing ? PAUSE_D : PLAY_D}</svg>}
              </button>
              <button type="button" className="ctrans__step" aria-label="Next segment" title="Next segment" style={{ opacity: player.idx >= rows.length - 1 ? 0.3 : 1 }} onClick={player.next}><Icon d={D.chevronRight} size={16} sw={1.8} /></button>
            </div>
            <span className="ctrans__mute">{mute(36)}</span>
          </div>
          <div className="ctrans__scrub">{scrub(deskScrub)}</div>
        </>
      )}
    </div>
  );
  const dp = useSideTabs<PubTab>('ga', { tabs, cur: tab, pref: tabs[0]?.key, onPick: setTab });
  const holdPct = Math.max(0, Math.min(100, Math.round(pct)));
  const holdThumb = stillThumb((shared?.job?.source as { thumbnailUrl?: string | null } | undefined)?.thumbnailUrl ?? props.poster ?? null);
  const holdSite = srcVideoUrl ? siteOf(srcVideoUrl) : null;
  const hold = holding && (
    <div className="gfull gfull--hold" data-theme="dark" role="status" aria-live="polite">
      {(ytId || holdThumb) && <div className="gfull__holdbg" style={{ backgroundImage: `url(${ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : holdThumb})` }} />}
      <div className="gfull__hold">
        {!shared ? <span className="gfull__spin gfull__holdspin" aria-label="Loading" /> : (
          <>
            {(name || holdSite) && <div className="gfull__holdt">{holdSite && <SiteIcon site={holdSite} size={18} tinted style={{ flex: 'none' }} />}{name && <span>{name}</span>}</div>}
            <div className="gfull__holdpct">{status === 'transcribing' ? `${holdPct}%` : <span className="gfull__spin gfull__holdspin" />}</div>
            <div className="gfull__holdbar"><div style={{ width: `${status === 'transcribing' ? holdPct : 0}%` }} /></div>
            <div className="gfull__holds">{status === 'transcribing' ? 'Transcribing' : status === 'cropping' ? 'Preparing the video' : 'Waiting to start'}{status === 'transcribing' && progress?.segmentsDone ? ` · ${segs.toLowerCase()}` : ''}</div>
            <div className="gfull__holdn">The video starts as soon as the first lines are transcribed.</div>
          </>
        )}
      </div>
    </div>
  );
  const tabPct = locked && shared && !txLive && (running || status === 'cropping') ? Math.max(0, Math.min(100, Math.round(pct))) : null;
  const onProgress = useRef(props.onProgress);
  onProgress.current = props.onProgress;
  useEffect(() => { onProgress.current?.(tabPct); }, [tabPct]);
  const [endDismissed, setEndDismissed] = useState(false);
  const atEnd = !!fullEl && !holding && (videoLed ? !!player.ended : !player.playing && player.dur > 0 && player.t >= player.dur - 0.5);
  useEffect(() => { if (!atEnd) setEndDismissed(false); }, [atEnd]);
  const endShown = props.endCard !== false && atEnd && !endDismissed;
  useEffect(() => { if (endShown) { setSettings(false); voice.closePicker(); } }, [endShown]); // eslint-disable-line react-hooks/exhaustive-deps
  const endCard = endShown && (
    <EndCard options={{ appUrl: props.appUrl, ...(props.endCard || {}) }} onStarted={props.onStarted} onClose={() => setEndDismissed(true)} onReplay={() => { setEndDismissed(true); autoplayDone.current = true; if (player.seekFrac) player.seekFrac(0); else player.seekRow(0); if (!player.playing) player.toggle(); }} />
  );
  const endPill = props.endCard !== false && atEnd && endDismissed && (
    <button type="button" className="vsp-endpill" onClick={(e) => { e.stopPropagation(); setEndDismissed(false); }}><Icon d={D.link} size={15} sw={1.8} />Transcribe a video</button>
  );
  if (locked) return <>{gone ? <div className="gfull" data-theme="dark">{gonePanel}</div> : hold || fullEl || <div className="gfull" data-theme="dark" />}{endCard}{endPill}{toast}</>;
  if (desk) {
    const deskAudio = listening && !watching && !gone && <div className="pubdeskctl">{pubTransport(true)}</div>;
    const sideOn = !gone && (tabs.length > 0 || watching || !!voice.sidePanel || !!deskAudio);
    return (
      <>
        <div className="dhead dhead--listener dhead--cols">
          <div className="gcolhead">
            <div className="gcolhead__main">
              <div className="gcolhead__col">
                <div style={{ flex: 'none' }}><Logo dark={dark} height={20.38} /></div>
                {!gone && (
                  <div className="dhead__session">
                    <span className="t">{shared ? name : ''}</span>
                    <span className="s">{shared ? subline : ''}</span>
                  </div>
                )}
              </div>
            </div>
            {sideOn && <div className="gcolhead__side" />}
          </div>
        </div>
        <div className="listenerlive listenerlive--cols listenerlive--pub">
          <div className="listenerlive__main">
            {gonePanel}
            {!gone && findField}
            {progressBox}
            {flash && <div className="pubflash">{flash}</div>}
            {!gone && <div className="listenerlive__inner" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: 6 }}>{lines}</div>}
            {!gone && (
              <div className="listenerlive__inner gdeskbar" data-transport="1">
                {meta.can && <span className="barchip" style={meta.active ? { background: 'var(--brand-tint)', boxShadow: '0 0 0 1.5px var(--brand)', borderRadius: 12 } : undefined}><LanguageChip flag={meta.flag} code={meta.code} label={meta.label} bordered={false} onClick={meta.onClick} /></span>}
                {modeSwitch}
              </div>
            )}
          </div>
          {sideOn && (
            <SideFrame id="ga" className="listenerside" gap={20} plain>
              {!voice.sidePanel && deskAudio}
              {!voice.sidePanel && video}
              {!voice.sidePanel && tabs.length > 0 && (
                <div data-panel-grid="" className="listenerside__panels">
                  <SidePanels col={dp} order={['summary', 'export']} onPick={setTab} grip={{ summary: 40, export: 28 }} render={(k) => <Card panel>{pubPanel(k)}</Card>} />
                </div>
              )}
              {voice.sidePanel}
            </SideFrame>
          )}
        </div>
        {!fullEl && voice.sheets}{!(locked && fullEl) && settingsSheet}{fullEl}{toast}
      </>
    );
  }
  const widgetOn = tabs.length > 0 && !find;
  const widget = widgetOn && (
    <div className="txwidget">
      <Card panel>
        <TabBar tabs={tabs} current={tab} onPick={setTab} gap={tab !== 'none'} />
        {tab !== 'none' && pubPanel(tab)}
      </Card>
    </div>
  );
  return (
    <>
      <ListenerHeader dark={dark} title={shared ? name : ''} subline={shared ? subline : ''} onOptions={() => setSettings(true)} optionsActive={settings} />
      {gonePanel}
      {progressBox}
      {!gone && widget}
      {!gone && video}
      {!gone && (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {findField}
          {lines}
          {flash && <div className="txflash">{flash}</div>}
        </div>
      )}
      {!gone && (
        <div className="gbottom" data-transport="1">
          {listening && !watching && <div className="pubctl">{pubTransport(false)}</div>}
          <div className="gbottom__bar">
            {meta.can && <div style={{ flex: 'none' }}>{chipFor({ width: 87 }, undefined)}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>{modeSwitch}</div>
          </div>
        </div>
      )}
      {!fullEl && voice.sheets}{!(locked && fullEl) && settingsSheet}{fullEl}{toast}
    </>
  );
}

function useSealed(url: string | null): 'yes' | 'no' | 'unknown' {
  const [st, setSt] = useState<{ url: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!url || (st?.url === url && st.ok)) return;
    let live = true;
    let h: ReturnType<typeof setTimeout> | undefined;
    const check = () => { void audioSealed(url).then((y) => { if (!live) return; setSt({ url, ok: y }); if (!y) h = setTimeout(check, 3000); }); };
    check();
    return () => { live = false; if (h) clearTimeout(h); };
  }, [url, st?.url === url && st?.ok]); // eslint-disable-line react-hooks/exhaustive-deps
  return !url || st?.url !== url ? 'unknown' : st.ok ? 'yes' : 'no';
}
