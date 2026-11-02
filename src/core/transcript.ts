import type { Correction, TranscriptSnapshot } from '@vocalstack/js-sdk';

export function fixedSlots(corrections: Correction[]): Set<string> {
  const evs: { at: string; c: Correction; undo: boolean }[] = [];
  for (const c of corrections) {
    if (c.kind !== 'word' || c.seq == null || c.wordIdx == null) continue;
    evs.push({ at: c.appliedAt, c, undo: false });
    if (c.revertedAt) evs.push({ at: c.revertedAt, c, undo: true });
  }
  evs.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.undo === b.undo ? 0 : a.undo ? 1 : -1));
  const slots = new Map<string, { seq: number; idx: number; n: number }>();
  for (const { c, undo } of evs) {
    const seq = c.seq as number, idx = c.wordIdx as number;
    const n = Math.max(1, c.to.split(/\s+/).filter(Boolean).length);
    if (undo) {
      const s = slots.get(c.id);
      if (!s) continue;
      slots.delete(c.id);
      for (const o of slots.values()) if (o.seq === s.seq && o.idx > s.idx) o.idx -= s.n - 1;
    } else {
      for (const o of slots.values()) if (o.seq === seq && o.idx > idx) o.idx += n - 1;
      slots.set(c.id, { seq, idx, n });
    }
  }
  const out = new Set<string>();
  for (const s of slots.values()) for (let k = 0; k < s.n; k++) out.add(`${s.seq}:${s.idx + k}`);
  return out;
}

export interface Word {
  text: string;
  prob?: number | null;
  start: number;
  end: number;
  alts?: { text: string; prob: number }[];
  script?: boolean;
  recognized?: string;
  seq: number;
  idx: number;
}

export interface Row {
  id: string;
  sentenceId?: number;
  seqs: number[];
  speaker: number;
  start: number;
  end?: number;
  wallStart: number;
  text: string;
  words: Word[];
  status: 'open' | 'closed';
  settled: boolean;
  corrected: boolean;
  catchup: boolean;
  suppressed: boolean;
  unclear?: boolean;
  confidence?: number;
  latencyS?: number;
  language?: string;
  translations: Record<string, string>;
  provisional: boolean;
  translationLatencyS?: Record<string, number>;
}

export interface Segment {
  seq: number;
  speaker: number;
  start: number;
  end: number;
  text: string;
  words: Word[];
  catchup: boolean;
  corrected: boolean;
  settled: boolean;
  suppressed: boolean;
  unclear?: boolean;
  confidence?: number;
  latencyS?: number;
  language?: string;
  translations: Record<string, string>;
  scriptPos?: number;
  scriptFrom?: number;
}

export interface Model {
  segments: Map<number, Segment>;
  sentences: Map<number, Omit<Row, 'words' | 'text' | 'seqs'> & { text: string; seqs: number[] }>;
  speakers: Record<number, string>;
  speakerSpeechS: Record<number, number>;
  speakerSex: Record<number, 'male' | 'female'>;
  speakerIds: Record<number, { name: string; voiceId?: string; color?: string; confidence?: number; tone?: boolean }>;
  labels?: 'auto' | 'on' | 'off';
  lastSeq: number;
  state: string;
  spans: { wallStart: number; wallEnd?: number | null; mediaStart: number; mediaEnd?: number | null }[];
  held?: { fromMediaS: number; language?: string } | null;
  numbers?: Map<number, number>;
}

export function empty(): Model {
  return {
    segments: new Map(),
    sentences: new Map(),
    speakers: {},
    speakerSpeechS: {},
    speakerSex: {},
    speakerIds: {},
    lastSeq: -1,
    state: 'pending',
    spans: [],
  };
}

export function mediaToWall(m: Model, media: number): number {
  for (const s of m.spans) {
    const end = s.mediaEnd ?? Infinity;
    if (media < end || s.mediaEnd == null) return s.wallStart + Math.max(0, media - s.mediaStart);
  }
  const last = m.spans[m.spans.length - 1];
  return last ? (last.wallEnd ?? last.wallStart) + Math.max(0, media - (last.mediaEnd ?? last.mediaStart)) : media;
}

function toWords(seq: number, raw: any[] | undefined): Word[] {
  return (raw ?? []).map((w, i) => ({ text: String(w.text ?? ''), prob: w.prob ?? null, start: w.start ?? 0, end: w.end ?? 0, alts: w.alts, ...(w.script === true ? { script: true } : {}), ...(w.script === true && typeof w.recognized === 'string' ? { recognized: w.recognized } : {}), seq, idx: i }));
}

export function fromSnapshot(snap: TranscriptSnapshot, base?: Model): Model {
  const m = base ?? empty();
  delete m.numbers;
  m.state = snap.state;
  if (snap.speakerLabels) m.labels = snap.speakerLabels;
  m.lastSeq = Math.max(m.lastSeq, snap.lastSeq);
  m.spans = snap.spans.map((s) => ({ wallStart: s.wallStart, wallEnd: s.wallEnd ?? null, mediaStart: s.mediaStart, mediaEnd: s.mediaEnd ?? null }));
  for (const s of snap.segments) {
    const sp = (s as { scriptPos?: number | null }).scriptPos;
    m.segments.set(s.seq, {
      scriptPos: sp ?? undefined,
      scriptFrom: (s as { scriptFrom?: number | null }).scriptFrom ?? undefined,
      seq: s.seq,
      speaker: s.speaker,
      start: s.start,
      end: s.end,
      text: s.text,
      words: toWords(s.seq, s.words as any),
      catchup: !!s.catchup,
      corrected: !!s.corrected,
      settled: !!s.settled,
      suppressed: !!s.suppressed,
      unclear: !!s.unclear,
      confidence: s.confidence ?? undefined,
      latencyS: s.latencyS ?? undefined,
      language: s.language ?? undefined,
      translations: (s.translations as Record<string, string>) ?? {},
    });
  }
  for (const s of snap.sentences) {
    m.sentences.set(s.sentenceId, {
      id: `s:${s.sentenceId}`,
      sentenceId: s.sentenceId,
      seqs: s.seqs,
      speaker: s.speaker,
      start: s.start,
      wallStart: s.wallStart,
      text: s.text,
      status: s.status === 'open' ? 'open' : 'closed',
      settled: !!s.settled,
      corrected: false,
      catchup: false,
      suppressed: !!s.suppressed,
      unclear: !!s.unclear,
      language: s.language ?? undefined,
      translations: (s.translations as Record<string, string>) ?? {},
      provisional: !!s.provisional,
    });
  }
  m.speakers = Object.fromEntries(
    snap.speakers.filter((s) => !!s.name).map((s) => [s.speaker, s.name]),
  );
  m.speakerSpeechS = Object.fromEntries(
    snap.speakers.filter((s) => typeof s.speechS === 'number').map((s) => [s.speaker, s.speechS as number]),
  );
  m.speakerSex = Object.fromEntries(
    snap.speakers.filter((s) => s.gender === 'male' || s.gender === 'female').map((s) => [s.speaker, s.gender as 'male' | 'female']),
  );
  m.speakerIds = Object.fromEntries(
    snap.speakers
      .filter((s) => !!s.identified || !!s.voiceId || !!s.voiceColor)
      .map((s) => [
        s.speaker,
        {
          name: s.name ?? '',
          voiceId: s.voiceId ?? undefined,
          color: s.voiceColor ?? undefined,
          confidence: s.identifiedConfidence ?? undefined,
        },
      ]),
  );
  return m;
}

export function scriptPosAt(m: Model, at?: number): number | undefined {
  let best: Segment | undefined;
  for (const s of m.segments.values()) {
    if (s.scriptPos == null) continue;
    if (at != null && s.end > at) continue;
    if (!best || s.seq > best.seq) best = s;
  }
  if (best) return best.scriptPos;
  return at != null && [...m.segments.values()].some((s) => s.scriptPos != null) ? 0 : undefined;
}

export function scriptSpan(m: Model, seqs: number[]): [number, number] | null {
  let from = Infinity, to = -Infinity;
  for (const q of seqs) {
    const s = m.segments.get(q);
    if (s?.scriptFrom == null || s.scriptPos == null) continue;
    from = Math.min(from, s.scriptFrom);
    to = Math.max(to, s.scriptPos);
  }
  return from < to ? [from, to] : null;
}

function foldTr(prev: Record<string, string> | undefined, next: unknown): Record<string, string> {
  const n = (next ?? {}) as Record<string, string>;
  if (!prev || !Object.keys(prev).length) return n;
  if (!Object.keys(n).length) return prev;
  return { ...prev, ...n };
}

function undoesAutoFix(words: Word[], f: any): boolean {
  const tail = f.tail;
  if (!tail || !Array.isArray(tail.words) || tail.replaced !== words.length || tail.words.length !== words.length) return false;
  let changed = false;
  for (let i = 0; i < words.length; i++) {
    const o = words[i], n = tail.words[i];
    const marked = !!o.script;
    if (n.script) { if (n.text !== o.text) return false; continue; }
    if (n.text === o.text && !marked) continue;
    if (!marked) return false;
    changed = true;
  }
  return changed;
}

export function applyFrame(m: Model, f: any): Model {
  delete m.numbers;
  switch (f.type) {
    case 'transcript.committed': {
      const seg = f.segment;
      const prev = m.segments.get(seg.seq);
      m.segments.set(seg.seq, {
        seq: seg.seq,
        speaker: seg.speaker,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        words: seg.words ? toWords(seg.seq, seg.words) : prev?.words ?? [],
        catchup: !!seg.catchup,
        corrected: prev?.corrected ?? false,
        settled: prev?.settled ?? false,
        suppressed: !!seg.suppressed,
        unclear: !!seg.unclear,
        confidence: seg.confidence ?? prev?.confidence,
        latencyS: seg.latencyS,
        language: seg.language,
        translations: foldTr(prev?.translations, seg.translations),
        scriptPos: seg.scriptPos ?? prev?.scriptPos,
        scriptFrom: seg.scriptPos != null ? seg.scriptFrom ?? undefined : prev?.scriptFrom,
      });
      if (seg.speakerName) m.speakers[seg.speaker] = seg.speakerName;
      break;
    }
    case 'transcript.held': {
      m.held = f.held ? { fromMediaS: f.fromMediaS ?? 0, language: f.language ?? undefined } : null;
      break;
    }
    case 'transcript.retracted': {
      for (const seq of f.seqs ?? []) m.segments.delete(seq);
      break;
    }
    case 'transcript.translated': {
      const s = m.segments.get(f.seq);
      if (s) s.translations = { ...s.translations, ...(f.translations ?? {}) };
      break;
    }
    case 'transcript.amended': {
      const s = m.segments.get(f.seq);
      if (s && s.corrected && undoesAutoFix(s.words, f)) {
        s.text = f.text;
        s.words = toWords(f.seq, f.tail.words);
        break;
      }
      if (s && !s.corrected) {
        s.text = f.text;
        if (f.speaker >= 0) s.speaker = f.speaker;
        const parts = String(f.text).split(/\s+/).filter(Boolean);
        if (f.tail && f.tail.replaced <= s.words.length) {
          const kept = s.words.slice(0, s.words.length - f.tail.replaced);
          s.words = toWords(f.seq, [...kept, ...f.tail.words]);
        } else if (parts.length === s.words.length) {
          s.words = s.words.map((w, i) => ({ ...w, text: parts[i] }));
        }
        if (f.scriptWords?.length) {
          const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
          const fixes = ((f.fixes ?? []) as { orig?: string; repl?: string; kind?: string }[]).filter((x) => String(x.kind ?? '').endsWith('script') && String(x.orig ?? '').trim());
          const heard = (w: Word) => w.recognized ?? fixes.find((x) => String(x.repl ?? '').split(/\s+/).map(norm).includes(norm(w.text)))?.orig?.trim();
          s.words = s.words.map((w, i) => {
            if (!f.scriptWords!.includes(i)) return w;
            const h = heard(w);
            return { ...w, script: true, ...(h ? { recognized: h } : {}) };
          });
        }
      }
      break;
    }
    case 'transcript.latency': {
      const s = m.segments.get(f.seq);
      if (s) s.latencyS = f.latencyS;
      break;
    }
    case 'transcript.speaker': {
      const s = m.segments.get(f.seq);
      if (s && f.speaker >= 0) s.speaker = f.speaker;
      break;
    }
    case 'transcript.sentence': {
      const s = f.sentence;
      if (s.status === 'dropped') {
        m.sentences.delete(s.sentenceId);
        break;
      }
      const prev = m.sentences.get(s.sentenceId);
      const keep = !!prev?.corrected && !s.corrected;
      m.sentences.set(s.sentenceId, {
        id: `s:${s.sentenceId}`,
        sentenceId: s.sentenceId,
        seqs: s.seqs,
        speaker: s.speaker,
        start: s.start,
        wallStart: mediaToWall(m, s.start),
        text: keep ? prev!.text : s.text,
        status: s.status === 'open' ? 'open' : 'closed',
        settled: !!s.settled,
        corrected: !!s.corrected || (prev?.corrected ?? false),
        catchup: false,
        suppressed: !!s.suppressed,
        unclear: !!s.unclear,
        language: s.language,
        translations: keep ? prev!.translations : foldTr(prev?.translations, s.translations),
        provisional: !!s.provisional,
        translationLatencyS: s.translationLatencyS,
      });
      if (s.speakerName) m.speakers[s.speaker] = s.speakerName;
      if (s.settled) for (const q of s.seqs as number[]) { const g = m.segments.get(q); if (g) g.settled = true; }
      break;
    }
    case 'transcript.corrected': {
      const s = m.segments.get(f.seq);
      if (s) {
        s.text = f.text;
        s.corrected = !f.reverted || s.corrected;
        const parts = String(f.text).split(/\s+/).filter(Boolean);
        if (Array.isArray((f as any).words)) s.words = toWords(f.seq, (f as any).words);
        else if (parts.length === s.words.length) s.words = s.words.map((w, i) => ({ ...w, text: parts[i], prob: i === f.wordIdx ? 1 : w.prob }));
        s.translations = {};
      }
      if (typeof f.sentenceId === 'number') {
        const t = m.sentences.get(f.sentenceId);
        if (t) {
          if (f.sentenceText) t.text = f.sentenceText;
          t.corrected = true;
          t.translations = {};
        }
      }
      break;
    }
    case 'transcript.speakerNamed':
      if (f.name) m.speakers[f.speaker] = f.name;
      else delete m.speakers[f.speaker];
      break;
    case 'transcript.speakerGender':
      if (f.gender === 'male' || f.gender === 'female') m.speakerSex[f.speaker] = f.gender;
      break;
    case 'transcript.speakerIdentified':
      if (f.name) {
        m.speakerIds[f.speaker] = {
          name: f.name,
          voiceId: f.voiceId,
          color: f.color,
          confidence: f.confidence,
          tone: !!f.tone,
        };
      } else delete m.speakerIds[f.speaker];
      break;
    case 'recording.state':
      m.state = f.state;
      break;
    default:
      break;
  }
  if (typeof f.seq === 'number') m.lastSeq = Math.max(m.lastSeq, f.seq);
  return m;
}

export function rows(m: Model): Row[] {
  const out: Row[] = [];
  const sentences = [...m.sentences.values()].sort((a, b) => a.start - b.start || (a.sentenceId ?? 0) - (b.sentenceId ?? 0));
  for (const s of sentences) {
    const segs = s.seqs.map((q) => m.segments.get(q)).filter(Boolean) as Segment[];
    const words = segs.length === s.seqs.length || !s.text ? segs.flatMap((g) => g.words) : [];
    const last = segs[segs.length - 1];
    out.push({
      ...s,
      words,
      ...(segs.length ? { end: Math.max(...segs.map((g) => g.end)) } : {}),
      text: s.text || segs.map((g) => g.text).join(' '),
      corrected: s.corrected || segs.some((g) => g.corrected),
      catchup: segs.some((g) => g.catchup),
      suppressed: s.suppressed || (segs.length > 0 && segs.every((g) => g.suppressed)),
      unclear: s.unclear || (segs.length > 0 && segs.every((g) => g.unclear)),
      confidence: sentenceConfidence(segs),
      latencyS: last?.latencyS,
      settled: s.settled || (segs.length > 0 && segs.every((g) => g.settled)),
      translations: Object.keys(s.translations).length ? s.translations : mergeSegTranslations(segs),
      speaker: s.speaker >= 0 ? s.speaker : last?.speaker ?? -1,
    });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function languageName(code?: string): string | undefined {
  if (!code) return undefined;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? undefined;
  } catch {
    return undefined;
  }
}

export function heldLine(m: Model): string | null {
  if (!m.held) return null;
  const name = languageName(m.held.language);
  return name ? `${name} · transcribing…` : 'Transcribing…';
}

function sentenceConfidence(segs: Segment[]): number | undefined {
  let sum = 0;
  let n = 0;
  for (const g of segs) {
    if (g.confidence == null) continue;
    const w = Math.max(1, g.words.length);
    sum += g.confidence * w;
    n += w;
  }
  return n ? sum / n : undefined;
}

function mergeSegTranslations(segs: Segment[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of segs) for (const [k, v] of Object.entries(g.translations)) out[k] = out[k] ? `${out[k]} ${v}` : v;
  return out;
}

export const CONF_MID = 0.85;
export const CONF_LOW = 0.75;

export function confClass(p?: number | null): '' | 'mid' | 'low' {
  if (p == null) return '';
  if (p < CONF_LOW) return 'low';
  if (p < CONF_MID) return 'mid';
  return '';
}

export function lowWords(r: Row, threshold = CONF_LOW): Word[] {
  return r.words.filter((w) => w.prob != null && w.prob < threshold);
}

export const LANES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export type Lane = (typeof LANES)[number];

export function lane(speaker: number): Lane {
  return LANES[((speaker % LANES.length) + LANES.length) % LANES.length];
}

export function speakerNumbers(m: Model): Map<number, number> {
  if (m.numbers) return m.numbers;
  const first = new Map<number, number>();
  const see = (speaker: number, at: number) => {
    if (speaker < 0) return;
    const was = first.get(speaker);
    if (was === undefined || at < was) first.set(speaker, at);
  };
  for (const s of m.sentences.values()) {
    const last = s.seqs.length ? m.segments.get(s.seqs[s.seqs.length - 1]) : undefined;
    see(s.speaker >= 0 ? s.speaker : last?.speaker ?? -1, s.start);
  }
  const order = [...first].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([k]) => k);
  const rest = [...new Set([...Object.keys(m.speakers), ...Object.keys(m.speakerIds)].map(Number))]
    .filter((k) => k >= 0 && !first.has(k))
    .sort((a, b) => a - b);
  m.numbers = new Map([...order, ...rest].map((k, i) => [k, i + 1]));
  return m.numbers;
}

export function speakerNumber(m: Model, speaker: number): number {
  if (speaker < 0) return 0;
  const n = speakerNumbers(m);
  return n.get(speaker) ?? n.size + 1 + speaker;
}

const GENERIC_NAME = /^\s*speaker\s+\d+\s*$/i;

function given(name?: string): string | undefined {
  return name && name.trim() && !GENERIC_NAME.test(name) ? name : undefined;
}

export function speakerName(m: Model, speaker: number): string | undefined {
  return given(m.speakers[speaker]) ?? given(m.speakerIds[speaker]?.name);
}

export function speakerLabel(m: Model, speaker: number): string {
  if (speaker < 0) return '';
  return speakerName(m, speaker) ?? `Speaker ${speakerNumber(m, speaker)}`;
}

export function speakerInitial(m: Model, speaker: number): string {
  if (speaker < 0) return '?';
  const named = speakerName(m, speaker);
  if (!named) return `S${speakerNumber(m, speaker)}`;
  const initials = named
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (initials || `S${speakerNumber(m, speaker)}`).toUpperCase();
}

export function speakerColor(voiceColor?: string | null): { fg: string; soft: string } | undefined {
  if (!voiceColor) return undefined;
  if (voiceColor.startsWith('#')) {
    return { fg: voiceColor, soft: `color-mix(in srgb, ${voiceColor} 16%, transparent)` };
  }
  if (!/^[1-6]$/.test(voiceColor)) return undefined;
  return { fg: `var(--vx-${voiceColor})`, soft: `var(--vx-${voiceColor}-soft)` };
}

export function speakerLook(m: Model, speaker: number): {
  fg?: string;
  soft?: string;
  lane: Lane;
  hasVoice: boolean;
} {
  const id = m.speakerIds[speaker];
  const c = speakerColor(id?.color);
  return { fg: c?.fg, soft: c?.soft, lane: lane(speakerNumber(m, speaker) - 1), hasVoice: !!id };
}

export function latestLatency(m: Model): number | undefined {
  let best: Segment | undefined;
  for (const g of m.segments.values()) if (!best || g.seq > best.seq) best = g;
  return best?.latencyS;
}

export function peakLatency(m: Model): number {
  let p = 0;
  for (const g of m.segments.values()) p = Math.max(p, g.latencyS ?? 0);
  return p;
}

export function showLabels(m: Model, rows: { speaker: number }[], fallback?: { speakerLabels?: 'auto' | 'on' | 'off' | null } | null, own = false): boolean {
  const said = fallback ? fallback.speakerLabels ?? 'auto' : null;
  const mode = (own ? said : null) ?? m.labels ?? said ?? 'on';
  if (mode !== 'auto') return mode === 'on';
  const seen = new Set<number>();
  for (const r of rows) if (r.speaker >= 0) { seen.add(r.speaker); if (seen.size > 1) return true; }
  return false;
}
