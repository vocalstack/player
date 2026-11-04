import './styles.css';

export { VocalStackPlayer, type VocalStackPlayerProps, type PlayerSettings, type PlayerControls, type PlayerHandle, type PlaybackState } from './ui/VocalStackPlayer';
export type { EndCardOptions } from './ui/EndCard';
export { PlayerApiProvider, usePlayerApi, useApi, type PlayerApi, type PlayerApiProviderProps, type ApiOptions, type PlayerSource, type TokenSource, type Listen } from './data/context';
export type { ErrorLike } from './data/errors';
export { setErrorReporter, type MediaCred } from './core/audio';
export { useTranscript } from './data/transcript';

export { useTxPlayer, useTxVoice, useDuck, useFlash, useYtLead, useFindPull, type FindState, YtFollow, MuteButton, TxLines, TxFind, lineWords, spokenWordOf, pictureT, lineEnd, PAUSE_D, PLAY_D, NO_SEEK, PUB_SIDE, type TxPlayer, type YtLead, type VoiceSheetHooks, type VoiceSheetCtx, type NoCloneNote } from './ui/core';
export { Transport, ReplayScrub, ExportPanel, SummaryPanel, SpeakerCast, VoiceSheetBody, useSummaryIn, useViewportTranslation, useArchiveVoice, useVoiceCatalogue, type AvailableVoice, type CastMember, type SummaryState } from './ui/shared';
export { FullVideo, MiniPlayer, PanelSeek, browserFull, realFull, setFullTarget, type PlayerPos, type PlayerTransport, type VoicesBtn } from './ui/full';
export { useBackgroundBed, useSeparatedTrack, bedNote, trackPlan, REMOVE_BG_LABEL, REMOVE_BG_NOTE, type BedState, type TrackPlan, type Separated } from './core/background';
export { snapPosition, placePosition, type PlayPos } from './core/playPosition';
export { SITES, siteOf, siteById, hostOfUrl, type Site, type SiteId } from './core/sites';
export { SiteIcon } from './ui/SiteIcon';
export { hasEmbed, linkVideoFile, sourceVideoUrl } from './core/embeds';
