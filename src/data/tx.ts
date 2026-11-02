import type { ExportFormat, TranscriptionJob } from '@vocalstack/js-sdk';
import { VocalStackError } from '@vocalstack/js-sdk';
import { voiceTrackDownloadUrl, type MediaCred } from '../core/audio';
import { rowForVoice, type VoiceTrackRow } from '../core/voiceplayer';
import type { PlayerApi } from './context';
import { GENERIC } from './errors';

async function answerError(r: Response): Promise<VocalStackError> {
  const j: any = await r.json().catch(() => null);
  const code = j?.error?.code ?? j?.code;
  const message = j?.error?.message ?? j?.message;
  return new VocalStackError(typeof code === 'string' ? code as never : 'internal', typeof message === 'string' ? message : GENERIC, { status: r.status, details: j?.error?.data?.details ?? j?.data?.details });
}

export type TxRowStatus = 'queued' | 'cropping' | 'transcribing' | 'done' | 'failed' | 'stopped' | 'live';

export interface TxProgress {
  state: TranscriptionJob['state'];
  processedS: number;
  totalS: number | null;
  segmentsDone: number;
  segmentsTotal: number | null;
  pct: number;
  error?: string | null;
}

export function rowStatusOf(state: TranscriptionJob['state'] | undefined | null): TxRowStatus {
  switch (state) {
    case 'transcribing': return 'transcribing';
    case 'cropping': return 'cropping';
    case 'done': return 'done';
    case 'failed': return 'failed';
    case 'stopped': return 'stopped';
    default: return 'queued';
  }
}

export function progressOf(job: TranscriptionJob | null): TxProgress | null {
  if (!job) return null;
  if (!job.progress) return job.state ? { state: job.state, processedS: 0, totalS: null, segmentsDone: 0, segmentsTotal: null, pct: 0, error: job.error ?? null } : null;
  return { state: job.state, processedS: job.progress.processedS, totalS: job.progress.totalS ?? null, segmentsDone: job.progress.segmentsDone, segmentsTotal: job.progress.segmentsTotal ?? null, pct: job.progress.pct, error: job.error ?? null };
}

export const segsLabel = (p: TxProgress | null, fallbackDone: number) => {
  const done = p?.segmentsDone ?? fallbackDone;
  const total = Math.max(done, p?.segmentsTotal ?? done);
  return `${done} / ${total} SEGMENTS`;
};

export function jobLengthS(job: TranscriptionJob | null | undefined, progress?: TxProgress | null): number | null {
  const full = job?.source?.durationS ?? progress?.totalS ?? null;
  const c = job?.crop;
  if (c && (c.startS != null || c.endS != null)) {
    const end = c.endS ?? full;
    if (end != null) return Math.max(0, end - (c.startS ?? 0));
  }
  return full;
}

export const TX_FORMATS: { key: ExportFormat; name: string; ext: string; note: string; icon: string }[] = [
  { key: 'pdf', name: 'PDF', ext: 'PDF', note: 'Formatted transcript in paragraphs, with timestamps and speaker labels.', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
  { key: 'xlsx', name: 'Excel', ext: 'XLSX', note: 'One row per segment: start, end, speaker, text, confidence.', icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0 0h-7.5m-9 0h7.5m0 0c.621 0 1.125.504 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5' },
  { key: 'srt', name: 'Subtitles', ext: 'SRT / VTT', note: 'Timed caption cues, ready for a video editor or a player.', icon: 'M2.25 15.75V8.25A2.25 2.25 0 0 1 4.5 6h15a2.25 2.25 0 0 1 2.25 2.25v7.5A2.25 2.25 0 0 1 19.5 18h-15a2.25 2.25 0 0 1-2.25-2.25Zm4.5-4.5h4.5m-4.5 3h1.5m3 0h6m-3-3h3' },
  { key: 'json', name: 'JSON', ext: 'JSON', note: 'Word-level timings, confidence scores and speaker turns.', icon: 'M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5' },
];

export function saveUrl(url: string) {
  const a = document.createElement('a');
  a.href = url; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
}

export async function saveWhenReady(url: string) {
  const r = await fetch(url, { redirect: 'manual' });
  if (r.type !== 'opaqueredirect' && !r.ok) throw await answerError(r);
  saveUrl(url);
}

export async function exportTranscript(api: PlayerApi, recordingId: string, key: ExportFormat, opts: { lang?: string | null } = {}) {
  const res = await api.client.recordings.export(recordingId, key, { lang: opts.lang ?? undefined, ...api.readAs });
  if (!res.ok) throw await answerError(res);
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const plain = /filename="([^"]+)"/i.exec(cd)?.[1];
  const name = star ? decodeURIComponent(star) : plain ?? `transcript.${key}`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export async function downloadVoiceTrack(api: PlayerApi, opts: {
  recordingId: string;
  lang: string;
  voiceKey: string;
  cred: MediaCred;
  request: () => Promise<unknown>;
  timeoutMs?: number;
}) {
  const { recordingId, lang, voiceKey, cred } = opts;
  const list = async (): Promise<VoiceTrackRow[]> => {
    const got = (await api.client.recordings.voice(recordingId, lang, api.readAs)) as unknown as VoiceTrackRow[];
    return got.filter((x) => x.lang === lang);
  };
  const mine = (rows: VoiceTrackRow[]) => rowForVoice(rows, voiceKey);
  let row = mine(await list());
  if (!row || row.state === 'clips' || row.state === 'failed') await opts.request();
  const until = Date.now() + (opts.timeoutMs ?? 10 * 60_000);
  while (!row || row.state !== 'sealed') {
    if (row?.state === 'failed') throw new Error(row.error || 'The spoken track could not be made.');
    if (Date.now() > until) throw new Error('The spoken track is taking too long; try again in a moment.');
    await new Promise((r) => setTimeout(r, 4000));
    row = mine(await list());
  }
  saveUrl(voiceTrackDownloadUrl(api.origin, recordingId, lang, row.voiceKey, cred));
}
