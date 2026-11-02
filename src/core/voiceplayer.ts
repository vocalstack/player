import { credParams, deliveryFormat, type MediaCred } from './audio';
import type { VoiceClip } from './clipQueue';

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
  voice?: string | null;
  wordTimes?: Record<string, [number, number][]>;
  clipRev?: Record<string, string>;
  clipDur?: Record<string, number>;
  clipParts?: Record<string, number>;
}

export function rowForVoice(rows: VoiceTrackRow[], voiceId: string | null): VoiceTrackRow | null {
  if (voiceId == null) return rows.find((r) => !r.voiceKey) ?? null;
  return rows.find((r) => r.voiceKey === voiceId) ?? rows.find((r) => !r.voiceKey && r.voice === voiceId) ?? null;
}

export function archiveClips(row: VoiceTrackRow | null | undefined, recordingId: string, apiOrigin: string, cred: MediaCred = {}, sentenceIds?: number[]): VoiceClip[] {
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
      src: `${apiOrigin}/v1/recordings/${recordingId}/voice/${sentenceId}?lang=${encodeURIComponent(row.lang)}${vk}&format=${deliveryFormat()}${part > 0 ? `&part=${part}` : ''}${rev ? `&v=${encodeURIComponent(rev)}` : ''}${tk}`,
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
