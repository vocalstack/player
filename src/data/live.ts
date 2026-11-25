import type { Transcription, TranscriptionJob } from '@vocalstack/js-sdk';

const LIVE_STATES = ['pending', 'live', 'paused'];

export function isLiveTranscription(t: Pick<Transcription, 'live' | 'state'> | null | undefined): boolean {
  return !!t && !!t.live && LIVE_STATES.includes(t.state);
}

export function streamOffsetS(ingest: { mediaAt?: string | null; streamStartedAt?: string | null } | null | undefined): number {
  if (!ingest?.mediaAt || !ingest.streamStartedAt) return 0;
  const s = (Date.parse(ingest.mediaAt) - Date.parse(ingest.streamStartedAt)) / 1000;
  return Number.isFinite(s) && s > 0 ? s : 0;
}

export function isRtmp(url: string | null | undefined): boolean {
  return !!url && /^rtmps?:\/\//i.test(url.trim());
}

type LiveTx = Pick<Transcription, 'id' | 'live' | 'state' | 'source' | 'ingest' | 'media'>;

const sealed = (tx: LiveTx, kind: string) => !!tx.media?.some((m) => m.kind === kind && m.state === 'sealed' && m.bytes > 0);

export function deliveryKept(tx: LiveTx): boolean {
  if (tx.state === 'idle' || LIVE_STATES.includes(tx.state)) return false;
  if (sealed(tx, 'delivery')) return true;
  return tx.state !== 'finalized' || !Array.isArray(tx.media);
}

export function liveJob(tx: LiveTx, url?: string | null): TranscriptionJob | null {
  const src = tx.source as { kind?: string; url?: string | null } | undefined;
  const link = url ?? (src?.kind === 'stream' ? src.url ?? null : null) ?? tx.ingest?.url ?? null;
  if (!link) {
    if (!deliveryKept(tx)) return null;
    return { transcriptionId: tx.id, state: 'done', hasAudio: true, hasVideo: sealed(tx, 'video'), crop: { startS: 0 } } as unknown as TranscriptionJob;
  }
  const done = tx.state === 'finalized';
  const hasVideo = isRtmp(link) && sealed(tx, 'video');
  return { transcriptionId: tx.id, state: done ? 'done' : 'transcribing', hasAudio: done, hasVideo, source: { kind: 'url', url: link }, crop: { startS: streamOffsetS(tx.ingest) } } as unknown as TranscriptionJob;
}

export function sourceOf(tx: LiveTx & Pick<Transcription, 'job'>): TranscriptionJob | null {
  if (tx.job) return tx.job;
  if (!tx.live) return null;
  return liveJob(tx);
}
