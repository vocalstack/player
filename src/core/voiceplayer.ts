import { credParams, deliveryFormat, type MediaCred } from './audio';
import type { VoiceClip } from './clipQueue';
import { sameLang } from './transcript';

export { ClipQueue, VoiceNotStarted, mediaKind, newMediaElement, type VoiceClip } from './clipQueue';

export function clipOf(f: any, apiOrigin: string, listenerToken?: string | null): VoiceClip | null {
  if (!f || f.type !== 'transcript.voice' || typeof f.sentenceId !== 'number') return null;
  let src: string | null = null;
  if (typeof f.url === 'string' && f.url) {
    const extra = [deliveryFormat() === 'caf' ? 'format=caf' : '', listenerToken ? `listenerToken=${encodeURIComponent(listenerToken)}` : ''].filter(Boolean).join('&');
    src = `${apiOrigin}${f.url}${extra ? `${f.url.includes('?') ? '&' : '?'}${extra}` : ''}`;
  } else if (typeof f.audio === 'string' && f.audio) {
    src = `data:audio/ogg;base64,${f.audio}`;
  }
  if (!src) return null;
  const part = Number(f.part ?? 0);
  return {
    sentenceId: f.sentenceId,
    lang: String(f.lang ?? ''),
    src,
    durationS: Number(f.durationS ?? 0),
    voice: f.voice ?? null,
    cloned: !!f.cloned,
    generation: typeof f.generation === 'number' ? f.generation : undefined,
    part: Number.isFinite(part) ? part : 0,
    parts: Math.max(1, Number(f.parts ?? 1) || 1),
  };
}

export interface VoiceTrackRow {
  lang: string;
  voiceKey: string;
  state: string;
  durationS?: number | null;
  error?: string | null;
  clips: number[];
  original?: number[];
  voice?: string | null;
  wordTimes?: Record<string, [number, number][]>;
  clipRev?: Record<string, string>;
  clipDur?: Record<string, number>;
  clipParts?: Record<string, number>;
  voices?: 'cloned' | 'synthetic' | 'mixed' | null;
  chosenFor?: string[];
}

export function rowForVoice(rows: VoiceTrackRow[], voiceId: string | null): VoiceTrackRow | null {
  if (voiceId == null) return rows.find((r) => !r.voiceKey) ?? null;
  return rows.find((r) => r.voiceKey === voiceId) ?? rows.find((r) => !r.voiceKey && r.voice === voiceId) ?? null;
}

export function trackFor(rows: VoiceTrackRow[], kind: 'cloned' | 'synthetic', voiceId: string | null): VoiceTrackRow | null {
  return rows.find((r) => r.chosenFor?.includes(kind)) ?? rowForVoice(rows, voiceId) ?? (kind === 'synthetic' ? rows.find((r) => r.voices === 'synthetic') ?? null : null);
}

export function archiveClips(row: VoiceTrackRow | null | undefined, transcriptionId: string, apiOrigin: string, cred: MediaCred = {}, sentenceIds?: number[]): VoiceClip[] {
  if (!row) return [];
  const ids = sentenceIds?.length ? sentenceIds : row.clips;
  if (!ids?.length) return [];
  const cp = credParams(cred);
  const tk = cp ? `&${cp}` : '';
  const vk = row.voiceKey ? `&voice=${encodeURIComponent(row.voiceKey)}` : '';
  return ids.flatMap((sentenceId) => {
    const rev = row.clipRev?.[String(sentenceId)];
    const parts = Math.max(1, row.clipParts?.[String(sentenceId)] ?? 1);
    return Array.from({ length: parts }, (_, part) => ({
      sentenceId,
      lang: row.lang,
      src: `${apiOrigin}/v1/transcriptions/${transcriptionId}/voice/${sentenceId}?lang=${encodeURIComponent(row.lang)}${vk}&format=${deliveryFormat()}${part > 0 ? `&part=${part}` : ''}${rev ? `&v=${encodeURIComponent(rev)}` : ''}${tk}`,
      durationS: parts === 1 ? row.clipDur?.[String(sentenceId)] ?? 0 : 0,
      voice: row.voice ?? null,
      cloned: false,
      part,
      parts,
    }));
  });
}

export interface ReadToken { t: string; sp: string }

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;

export function readTokens(text: string): ReadToken[] {
  const out: ReadToken[] = [];
  let buf = '';
  let lead = '';
  const push = (t: string) => { out.push({ t: lead + t, sp: '' }); lead = ''; };
  const flush = (sp: string) => {
    if (buf && out.length && !/[\p{L}\p{N}]/u.test(buf)) { out[out.length - 1].sp += buf + sp; buf = ''; return; }
    if (buf) { push(buf); buf = ''; out[out.length - 1].sp = sp; }
    else if (sp) { if (out.length) out[out.length - 1].sp += sp; else lead += sp; }
  };
  for (const ch of text) {
    if (/\s/.test(ch)) { flush(ch); continue; }
    if (CJK.test(ch)) { flush(''); push(ch); continue; }
    buf += ch;
  }
  flush('');
  return out;
}

export interface ReadPos { t: number; dur: number; words?: [number, number][] | null }

export function readCursor(tokens: ReadToken[], pos: ReadPos): number | null {
  const w = pos.words;
  if (w && w.length === tokens.length && tokens.length > 0) {
    let at = 0;
    for (let i = 0; i < w.length; i++) if (pos.t >= w[i][0]) at = i; else break;
    return at;
  }
  if (!(pos.dur > 0)) return null;
  return tokenAt(tokens, pos.t, pos.dur);
}

export function tokenAt(tokens: ReadToken[], pos: number, dur: number): number {
  if (tokens.length <= 1 || !(dur > 0)) return 0;
  const w = tokens.map((k) => k.t.length + 1.6);
  const total = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  const want = Math.max(0, Math.min(1, pos / dur)) * total;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (want < acc) return i;
  }
  return tokens.length - 1;
}

export interface LangLine { sentenceId?: number | null; language?: string | null; suppressed?: boolean; unclear?: boolean }

const readable = (r: LangLine): r is LangLine & { sentenceId: number } => r.sentenceId != null && !r.suppressed && !r.unclear;

export function originalLines(rows: readonly LangLine[], lang: string | null | undefined, spoken: string | null | undefined, listed?: readonly number[] | null): Set<number> {
  const out = new Set<number>(listed ?? []);
  if (!lang) return out;
  for (const r of rows) if (readable(r) && sameLang(r.language || spoken, lang)) out.add(r.sentenceId);
  return out;
}

export function readsAllOriginal(rows: readonly LangLine[], lang: string | null | undefined, spoken: string | null | undefined): boolean {
  if (!lang) return false;
  const lines = rows.filter(readable);
  return lines.length > 0 && lines.every((r) => sameLang(r.language || spoken, lang));
}

export function voicedLines(rows: readonly LangLine[], original: ReadonlySet<number>): number[] {
  return rows.filter(readable).map((r) => r.sentenceId).filter((id) => !original.has(id));
}

export function missingClips(sentenceIds: readonly number[], made: ReadonlySet<number>, original?: readonly number[] | null): number[] {
  const orig = new Set(original ?? []);
  return sentenceIds.filter((id) => !made.has(id) && !orig.has(id));
}
