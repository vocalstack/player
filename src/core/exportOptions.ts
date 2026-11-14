export type ExportKind = 'pdf' | 'xlsx' | 'srt' | 'vtt' | 'txt' | 'md' | 'json';
export type ExportSpeakersOpt = 'auto' | 'on' | 'off';
export type ExportTimestampsOpt = 'paragraph' | 'line' | 'off';
export type ExportChoice = { speakerLabels?: ExportSpeakersOpt; timestamps?: ExportTimestampsOpt; startS?: number; endS?: number; summary?: boolean };
export type ExportTextKind = 'txt' | 'md' | 'srt' | 'vtt';
export type ExportTab = 'pdf' | 'xlsx' | 'subs' | 'text' | 'json';

export type Prefs = {
  speakers: Partial<Record<'pdf' | 'xlsx' | 'subs' | 'text', ExportSpeakersOpt>>;
  timestamps: Record<'pdf' | 'text', ExportTimestampsOpt>;
  subs: 'srt' | 'vtt';
  text: 'txt' | 'md';
  summary: boolean;
};

const PREFS_KEY = 'vsp.export.v1';
const DEFAULT_PREFS: Prefs = {
  speakers: {},
  timestamps: { pdf: 'paragraph', text: 'paragraph' },
  subs: 'srt',
  text: 'txt',
  summary: false,
};

export function readExportPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null;
    if (!raw) return DEFAULT_PREFS;
    return {
      speakers: Object.fromEntries(Object.entries(raw.speakers ?? {}).filter(([, v]) => v === 'auto' || v === 'on' || v === 'off')),
      timestamps: { ...DEFAULT_PREFS.timestamps, ...(raw.timestamps ?? {}) },
      subs: raw.subs === 'vtt' ? 'vtt' : 'srt',
      text: raw.text === 'md' ? 'md' : 'txt',
      summary: !!raw.summary,
    };
  } catch { return DEFAULT_PREFS; }
}

export function keepPrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { }
}

export function tabOf(k: ExportKind): ExportTab {
  return k === 'srt' || k === 'vtt' ? 'subs' : k === 'txt' || k === 'md' ? 'text' : k;
}

export function kindFor(tab: ExportTab, p: Prefs): ExportKind {
  return tab === 'subs' ? p.subs : tab === 'text' ? p.text : tab;
}

export function choiceFor(tab: ExportTab, p: Prefs, range: { startS?: number; endS?: number } = {}): ExportChoice {
  const c: ExportChoice = { ...range };
  if ((tab === 'pdf' || tab === 'xlsx' || tab === 'subs' || tab === 'text') && p.speakers[tab]) c.speakerLabels = p.speakers[tab];
  if (tab === 'pdf' || tab === 'text') c.timestamps = p.timestamps[tab];
  if ((tab === 'pdf' || tab === 'text' || tab === 'json') && p.summary) c.summary = true;
  return c;
}

export function parseClock(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return null;
  return t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

export type Cue = { start: string; end: string; who: string; text: string };

export function vttCues(src: string): Cue[] {
  const out: Cue[] = [];
  for (const block of src.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n');
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at < 0) continue;
    const [a, b] = lines[at].split('-->').map((x) => x.trim().split(' ')[0]);
    const body = lines.slice(at + 1).filter((l) => l.trim()).join(' ').trim();
    const m = /^<v ([^>]*)>(.*)$/.exec(body);
    const who = m ? m[1] : '';
    let text = m ? m[2] : body;
    if (who && text.startsWith(`${who}: `)) text = text.slice(who.length + 2);
    out.push({ start: a.replace(/\.\d+$/, '').replace(/^00:/, ''), end: b.replace(/\.\d+$/, '').replace(/^00:/, ''), who, text: text.replace(/<[^>]+>/g, '') });
  }
  return out;
}

export type Page = { title: string; meta: string; summary: string[]; blocks: { who: string; when: string; text: string }[] };

const unescape = (s: string) => s.replace(/\\(.)/g, '$1');

export function mdPage(src: string): Page {
  const page: Page = { title: '', meta: '', summary: [], blocks: [] };
  let inSummary = false;
  for (const chunk of src.replace(/\r/g, '').split(/\n{2,}/)) {
    const c = chunk.trim();
    if (!c) continue;
    if (c.startsWith('# ')) { page.title = unescape(c.slice(2).split('\n')[0]); const rest = c.split('\n').slice(1).join(' ').trim(); if (rest) page.meta = rest.replace(/^_|_$/g, ''); continue; }
    if (/^_.*_$/.test(c) && !page.meta) { page.meta = c.slice(1, -1); continue; }
    if (c === '## Summary') { inSummary = true; continue; }
    if (c === '## Transcript') { inSummary = false; continue; }
    if (inSummary) { page.summary.push(unescape(c)); continue; }
    const lines = c.split('\n');
    const head = lines.length > 1 && lines[0].endsWith('  ') ? lines[0].trim() : '';
    const body = unescape((head ? lines.slice(1) : lines).join(' '));
    const who = /\*\*(.+?)\*\*/.exec(head)?.[1];
    const when = /`([^`]+)`/.exec(head)?.[1];
    page.blocks.push({ who: who ? unescape(who) : '', when: when ?? '', text: body });
  }
  return page;
}

export function srtAsVtt(src: string) {
  return src.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}
