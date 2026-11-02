export interface AudioFacts {
  state?: string | null;
  mediaDurationS?: number | null;
  ingest?: { state?: string | null; error?: string | null; startedAt?: string | null } | null;
}

export type NoAudio = { none: false } | { none: true; message: string };

export function recordingAudio(rec: AudioFacts | null | undefined, lines: number): NoAudio {
  if (!rec || (rec.state !== 'ended' && rec.state !== 'finalized')) return { none: false };
  if (lines > 0 || (rec.mediaDurationS ?? 0) > 0) return { none: false };
  const i = rec.ingest;
  if (i && i.startedAt && i.state !== 'failed') return { none: false };
  if (!i && rec.state !== 'finalized') return { none: false };
  return { none: true, message: noAudioMessage(i?.error) };
}

export function noAudioMessage(reason?: string | null): string {
  const r = (reason ?? '').trim().replace(/\.$/, '');
  return r ? `No audio was recorded: ${r[0].toLowerCase()}${r.slice(1)}.` : 'No audio was recorded: the recording ended before any audio arrived.';
}

export function isNotCaptured(message?: string | null): boolean {
  return /\bwas not captured\b/i.test(message ?? '');
}
