export function clock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function durationLabel(s?: number | null): string {
  if (!s || s <= 0) return '—';
  const m = Math.round(s / 60);
  if (m < 1) return `${Math.round(s)}s`;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return `${h} h ${String(r).padStart(2, '0')} min`;
}

export function lengthLabel(s: number): string {
  const t = Math.max(0, Math.round(s));
  if (t < 60) return `${t} s`;
  if (t < 600) return t % 60 ? `${Math.floor(t / 60)} min ${t % 60} s` : `${t / 60} min`;
  return durationLabel(t);
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) });
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function monDay(iso?: string | null): { mon: string; day: string } {
  if (!iso) return { mon: '—', day: '' };
  const d = new Date(iso);
  return { mon: MON[d.getMonth()], day: String(d.getDate()).padStart(2, '0') };
}

export function timeOfDay(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function recordingWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mon = MON[d.getMonth()];
  return `${WD[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${mon[0]}${mon.slice(1).toLowerCase()} · ${timeOfDay(iso)}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayGroup(iso?: string | null): string {
  if (!iso) return 'UNDATED';
  const d = new Date(iso), now = new Date();
  if (sameDay(d, now)) return 'TODAY';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return 'YESTERDAY';
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 7) return 'LAST WEEK';
  if (days < 31) return 'LAST MONTH';
  return 'OLDER';
}

export function whenLabel(iso?: string | null): string {
  if (!iso) return 'Recording';
  const d = new Date(iso), now = new Date();
  const t = timeOfDay(iso);
  if (sameDay(d, now)) return `Today at ${t}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${t}`;
}

export function ago(iso?: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function dwell(s: number): string {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function highlightParts(text: string, query: string): { t: string; hit: boolean }[] {
  const q = query.trim();
  if (!q) return [{ t: text, hit: false }];
  const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!tokens.length) return [{ t: text, hit: false }];
  const re = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  const out: { t: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: text.slice(last, i), hit: false });
    out.push({ t: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), hit: false });
  return out;
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
