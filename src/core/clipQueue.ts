import { startingRetryMs } from './voiceRetry';
import { ClipPrefetch } from './clipPrefetch';

export const mediaKind = { video: false };

export function newMediaElement(url?: string): HTMLMediaElement {
  if (!mediaKind.video) return new Audio(url);
  const v = document.createElement('video');
  v.playsInline = true;
  if (url) v.src = url;
  return v;
}

export interface VoiceClip {
  sentenceId: number;
  lang: string;
  src: string;
  durationS: number;
  generation?: number;
  part: number;
  parts: number;
  voice?: string | null;
  cloned?: boolean;
}

export class VoiceNotStarted extends Error {
  constructor() { super('The voice did not start in time.'); this.name = 'VoiceNotStarted'; }
}

export class ClipQueue {
  private el: HTMLMediaElement | null = null;
  private clips = new Map<number, { total: number; got: Map<number, VoiceClip> }>();
  private order: number[] = [];
  current: number | null = null;
  private currentPart = 0;
  private partBase = 0;
  private within: { id: number; frac: number } | null = null;
  playing = false;
  muted = false;
  rate = 1;
  volume = 1;
  finite = false;
  onSentence: (id: number | null) => void = () => {};
  onWaiting: (id: number | null) => void = () => {};
  onStarting: (since: number | null) => void = () => {};
  speakable: (sentenceId: number) => boolean = () => true;
  coming: (sentenceId: number) => boolean = () => false;
  gapBefore: (prev: number | null, next: number) => number = () => 0;
  flow = false;
  silentSpan: (sentenceId: number) => { fromS: number; ms: number } | null = () => null;
  private lastDone: number | null = null;
  private rested = false;
  private rest: { prev: number; totalMs: number; doneMs: number; since: number | null; timer: ReturnType<typeof setTimeout> | null; silent?: boolean; fromS?: number } | null = null;
  private sequence: number[] = [];
  private seqAt = new Map<number, number>();
  setSequence(ids: number[]) {
    if (ids.length === this.sequence.length && ids.every((id, i) => this.sequence[i] === id)) return;
    this.sequence = ids;
    this.seqAt = new Map(ids.map((id, i) => [id, i]));
    this.order.sort((a, b) => this.rank(a) - this.rank(b));
  }

  private rank(id: number): number {
    if (!this.sequence.length) return id;
    const i = this.seqAt.get(id);
    return i == null ? Number.MAX_SAFE_INTEGER : i;
  }

  private expected(afterId: number): number | null {
    if (!this.sequence.length) return null;
    const i = this.seqAt.get(afterId);
    if (i == null) return afterId < 0 ? this.sequence[0] ?? null : null;
    return this.sequence[i + 1] ?? null;
  }
  static WAIT_MS = 15_000;
  static START_WAIT_MS = 4_000;
  static COMING_MS = 120_000;
  static SKEW_LINES = 3;
  private spoken = new Set<number>();
  private lastRead: number | null = null;
  private started = false;
  private awaiting: { id: number; part: number } | null = null;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;
  onError: (e: unknown) => void = () => {};
  private floor = 0;
  private loading: number | null = null;
  readAhead = 0;
  readAheadS = 0;
  readonly prefetch = new ClipPrefetch();
  private warmed = new Set<string>();
  private static readonly RETRIES = 4;
  private static readonly RETRY_MS = 1200;
  private static readonly STARTING_MS = 300_000;
  private startingSince = new Map<number, number>();
  private retries = new Map<number, number>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  add(clip: VoiceClip) {
    if (!this.speakable(clip.sentenceId)) return;
    const c: VoiceClip = { ...clip, part: Math.max(0, clip.part || 0), parts: Math.max(1, clip.parts || 1) };
    let line = this.clips.get(c.sentenceId);
    if (!line) {
      line = { total: Math.max(1, c.parts), got: new Map() };
      this.clips.set(c.sentenceId, line);
      this.order = [...this.clips.keys()].sort((a, b) => this.rank(a) - this.rank(b));
    }
    line.total = Math.max(line.total, c.parts, c.part + 1);
    const held = line.got.get(c.part);
    if (held) {
      const newer = c.generation != null && (held.generation == null || c.generation > held.generation);
      if (!newer || held.src === c.src) return;
      line.got.set(c.part, c);
      if (this.current === c.sentenceId && this.currentPart === c.part && held.generation != null) this.swap(c);
      return;
    }
    line.got.set(c.part, c);
    if (this.current != null) this.warm(this.current);
    else if (this.awaiting) this.warm(this.awaiting.id, true);
    if (!this.playing || this.current != null || this.rest?.silent) return;
    const w = this.awaiting;
    if (w) {
      if (c.sentenceId === w.id && c.part === w.part) {
        this.stopWaiting();
        this.startPart(w.id, w.part);
      }
      return;
    }
    if (this.rank(c.sentenceId) < this.rank(this.floor)) return;
    this.follow();
  }

  private piecesOf(id: number): number[] {
    const line = this.clips.get(id);
    return line ? [...line.got.keys()].sort((a, b) => a - b) : [];
  }

  private due(): { start: number } | { wait: number } | { silent: number } | null {
    let exp = this.lastRead != null ? this.expected(this.lastRead) : this.floorOrBefore();
    while (exp != null && (this.spoken.has(exp) || !this.speakable(exp))) exp = this.expected(exp);
    const held = this.earliestHeld();
    if (exp != null && (held == null || this.rank(exp) < this.rank(held))) {
      if (this.piecesOf(exp).length) return { start: exp };
      if (this.flow) return { silent: exp };
      if (this.coming(exp)) return { wait: exp };
      if (this.started && held != null) return { wait: exp };
      if (held != null && this.rank(held) - this.rank(exp) <= ClipQueue.SKEW_LINES) return { wait: exp };
    }
    return held != null ? { start: held } : null;
  }

  private follow() {
    const d = this.due();
    const prev = this.lastDone;
    this.lastDone = null;
    if (d && 'start' in d) {
      const rested = this.rested;
      this.rested = false;
      const gap = this.playing && !rested ? this.gapBefore(prev, d.start) / (this.rate || 1) : 0;
      if (gap > 0.05) { this.restAfter(prev ?? d.start, gap * 1000); return; }
      this.start(d.start);
      return;
    }
    if (d && 'silent' in d) { this.silentLine(d.silent); return; }
    if (d && 'wait' in d) { this.waitFor(d.wait, 0); return; }
    if (this.finite) this.playing = false;
    this.current = null;
    this.onSentence(null);
  }

  private restAfter(prev: number, ms: number) {
    this.clearRest();
    this.current = null;
    this.rest = { prev, totalMs: ms, doneMs: 0, since: null, timer: null };
    this.runRest();
    this.onSentence(prev);
  }

  joinSilently(id: number) {
    this.stopWaiting();
    this.el?.pause();
    this.playing = true;
    this.floor = id;
    this.lastRead = null;
    this.lastDone = null;
    this.silentLine(id);
  }

  private silentLine(id: number) {
    const span = this.silentSpan(id);
    this.clearRest();
    this.finishLine(id);
    this.started = true;
    this.lastRead = this.lastRead == null ? id : Math.max(this.lastRead, id);
    this.rest = { prev: id, totalMs: Math.max(0, span?.ms ?? 0), doneMs: 0, since: null, timer: null, silent: true, fromS: span?.fromS ?? 0 };
    this.runRest();
    this.onSentence(id);
  }

  private runRest() {
    const r = this.rest;
    if (!r || r.timer) return;
    r.since = Date.now();
    r.timer = setTimeout(() => {
      if (this.rest !== r) return;
      this.rest = null;
      if (!this.playing) return;
      this.rested = true;
      this.follow();
    }, Math.max(0, r.totalMs - r.doneMs));
  }

  private holdRest() {
    const r = this.rest;
    if (!r || !r.timer) return;
    clearTimeout(r.timer);
    r.timer = null;
    if (r.since != null) r.doneMs += Date.now() - r.since;
    r.since = null;
  }

  private clearRest() {
    if (this.rest?.timer) clearTimeout(this.rest.timer);
    this.rest = null;
  }

  resting(): { sentenceId: number; s: number; silent: boolean } | null {
    const r = this.rest;
    if (!r) return null;
    const ms = r.doneMs + (r.since != null ? Date.now() - r.since : 0);
    const s = (Math.min(ms, r.totalMs) / 1000) * (this.rate || 1);
    return { sentenceId: r.prev, s: r.silent ? (r.fromS ?? 0) + s : s, silent: !!r.silent };
  }

  private finishLine(id: number) {
    this.lastDone = id;
    this.spoken.add(id);
    this.current = null;
    this.currentPart = 0;
    this.partBase = 0;
  }

  private earliestHeld(): number | null {
    const floor = this.rank(this.floor);
    for (const id of this.order) if (this.rank(id) >= floor && !this.spoken.has(id) && this.speakable(id) && this.piecesOf(id).length) return id;
    return null;
  }

  private floorOrBefore(): number | null {
    if (!this.sequence.length) return null;
    const i = this.seqAt.get(this.floor);
    if (i != null) return this.floor;
    return this.sequence.find((id) => this.rank(id) >= this.rank(this.floor)) ?? null;
  }

  private waitFor(id: number, part: number) {
    const beforeFirst = !this.started;
    this.warm(id, true);
    this.current = null;
    this.awaiting = { id, part };
    this.onSentence(id);
    this.onWaiting(id);
    if (this.waitTimer) clearTimeout(this.waitTimer);
    const patience = this.coming(id) ? ClipQueue.COMING_MS : beforeFirst ? ClipQueue.START_WAIT_MS : ClipQueue.WAIT_MS;
    this.waitTimer = setTimeout(() => {
      this.waitTimer = null;
      const w = this.awaiting;
      if (!w || w.id !== id || w.part !== part || !this.playing) return;
      this.awaiting = null;
      this.onWaiting(null);
      if (beforeFirst) {
        const first = this.earliestHeld();
        if (first != null) { this.floor = first; this.start(first); return; }
        this.follow();
        return;
      }
      this.finishLine(id);
      this.follow();
    }, patience);
  }

  private stopWaiting() {
    this.awaiting = null;
    if (this.waitTimer) { clearTimeout(this.waitTimer); this.waitTimer = null; }
  }

  has(sentenceId: number) { return this.clips.has(sentenceId); }
  get size() { return this.clips.size; }
  latest(): VoiceClip | null { return this.order.length ? this.clipAt(this.order[this.order.length - 1]) : null; }
  clipAt(sentenceId: number): VoiceClip | null {
    const line = this.clips.get(sentenceId);
    if (!line) return null;
    const first = [...line.got.keys()].sort((a, b) => a - b)[0];
    return first == null ? null : line.got.get(first) ?? null;
  }

  private from(sentenceId: number | null): number | null {
    if (sentenceId == null) return null;
    for (const id of this.order) if (id >= sentenceId && this.speakable(id)) return id;
    return null;
  }

  private edge(): number { return this.order.length ? this.order[this.order.length - 1] + 1 : 0; }

  play(sentenceId: number | null) {
    this.clearRest();
    this.lastDone = null;
    this.playing = true;
    this.floor = Math.min(sentenceId ?? this.edge(), this.edge());
    this.stopWaiting();
    for (const id of [...this.spoken]) if (this.rank(id) >= this.rank(this.floor)) this.spoken.delete(id);
    this.lastRead = null;
    this.follow();
  }

  pause() {
    this.holdRest();
    this.playing = false;
    this.onWaiting(null);
    this.onStarting(null);
    this.el?.pause();
  }

  resume(sentenceId: number | null): boolean {
    if (this.rest && this.rest.prev === sentenceId) {
      this.playing = true;
      this.runRest();
      this.onSentence(this.rest.prev);
      return true;
    }
    const el = this.el;
    if (!el || this.current == null || this.current !== sentenceId || !el.currentSrc || el.ended || el.error || this.startingSince.has(this.current)) return false;
    this.playing = true;
    this.stopWaiting();
    void el.play().catch((e) => {
      if ((e as { name?: string } | null)?.name === 'AbortError') return;
      this.failed(this.current ?? sentenceId!, e);
    });
    this.onSentence(this.current);
    return true;
  }

  private swap(c: VoiceClip) {
    const el = this.el;
    if (!el) return;
    const at = Math.max(0, el.currentTime - 0.3);
    const going = this.playing && !el.paused && !el.ended;
    this.loading = c.sentenceId;
    el.src = this.srcOf(c);
    el.addEventListener('loadedmetadata', () => {
      try { el.currentTime = Number.isFinite(el.duration) && el.duration > 0 ? Math.min(at, Math.max(0, el.duration - 0.1)) : at; } catch { }
    }, { once: true });
    if (!going) return;
    this.onWaiting(c.sentenceId);
    void el.play().catch((e) => {
      if ((e as { name?: string } | null)?.name === 'AbortError') return;
      this.failed(c.sentenceId, e);
    });
  }

  readingAt(): number | null { return this.current ?? this.awaiting?.id ?? (this.playing ? this.floor : null); }

  arm(sentenceId: number | null) {
    this.clearRest();
    this.lastDone = null;
    this.playing = true;
    this.current = null;
    this.floor = sentenceId ?? 0;
    this.stopWaiting();
    this.spoken.clear();
    this.lastRead = null;
    this.started = false;
    this.onSentence(null);
    this.warm(this.floor, true);
  }

  seekWithin(t: number) {
    const el = this.el;
    if (!el || this.current == null) return;
    const at = t - this.partBase;
    if (at < 0 || (Number.isFinite(el.duration) && el.duration > 0 && at >= el.duration)) return;
    try { el.currentTime = at; } catch { }
  }

  seek(sentenceId: number | null) {
    if (!this.playing) { this.clearRest(); this.lastDone = null; this.floor = Math.min(sentenceId ?? this.edge(), this.edge()); this.current = null; this.warm(this.floor, true); return; }
    this.play(sentenceId);
  }

  setMuted(m: boolean) { this.muted = m; if (this.el) this.el.muted = m; }
  setVolume(v: number) { this.volume = v; if (this.el) this.el.volume = v; }
  setRate(r: number) { this.rate = r; if (this.el) this.el.playbackRate = r; }

  private start(id: number) {
    const first = this.piecesOf(id)[0];
    this.partBase = 0;
    if (this.within && this.within.id !== id) this.within = null;
    this.startPart(id, first ?? 0);
  }

  private startPartAt(id: number, part: number, sec: number) {
    this.within = null;
    const base = this.partBase;
    this.startPart(id, part);
    this.partBase = base;
    const el = this.el;
    if (el && this.current === id && sec > 0.05) {
      el.addEventListener('loadedmetadata', () => {
        try { el.currentTime = Number.isFinite(el.duration) && el.duration > 0 ? Math.min(sec, Math.max(0, el.duration - 0.1)) : sec; } catch { }
      }, { once: true });
    }
  }

  startWithin(sentenceId: number, frac: number) {
    this.within = frac > 0.01 ? { id: sentenceId, frac: Math.min(0.98, frac) } : null;
  }

  private startPart(id: number, part: number) {
    const line = this.clips.get(id);
    const c = line?.got.get(part);
    if (!this.speakable(id)) {
      this.finishLine(id);
      this.follow();
      return;
    }
    if (!c) { this.waitFor(id, part); return; }
    const w = this.within && this.within.id === id && part === this.piecesOf(id)[0] ? this.within : null;
    let at = 0;
    if (w) {
      this.within = null;
      if (line!.total > 1) {
        const lens = Array.from({ length: line!.total }, (_, i) => line!.got.get(i)?.durationS ?? 0);
        const total = lens.reduce((x, y) => x + y, 0);
        if (total > 0 && lens.every((d) => d > 0)) {
          const target = w.frac * total;
          let k = 0, base = 0;
          while (k < lens.length - 1 && base + lens[k] <= target) base += lens[k++];
          at = -(target - base);
          if (k !== part) { this.partBase = base; this.startPartAt(id, k, target - base); return; }
        }
      } else at = w.frac;
    }
    this.stopWaiting();
    this.clearRest();
    this.started = true;
    this.lastRead = this.lastRead == null ? id : Math.max(this.lastRead, id);
    if (part === 0) this.partBase = 0;
    this.currentPart = part;
    this.current = id;
    this.loading = id;
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    const el = this.element();
    el.src = this.srcOf(c);
    this.warm(id);
    if (at !== 0) {
      el.addEventListener('loadedmetadata', () => {
        const len = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
        const sec = at > 0 ? at * len : -at;
        try { if (sec > 0.05) el.currentTime = len ? Math.min(sec, Math.max(0, len - 0.1)) : sec; } catch { }
      }, { once: true });
    }
    el.muted = this.muted;
    el.volume = this.volume;
    el.playbackRate = this.rate;
    this.onSentence(id);
    this.onWaiting(id);
    void el.play().catch((e) => {
      if ((e as { name?: string } | null)?.name === 'AbortError') return;
      this.failed(id, e);
    });
  }

  upcoming(from: number, withFrom = false): VoiceClip[] {
    const out: VoiceClip[] = [];
    let secs = 0;
    const enough = () => out.length >= Math.max(this.readAhead, 1) && secs >= this.readAheadS;
    const cur = this.clips.get(from);
    if (cur) {
      for (const part of this.piecesOf(from)) {
        if (!withFrom && (this.current !== from || part <= this.currentPart)) continue;
        const c = cur.got.get(part);
        if (c) { out.push(c); secs += c.durationS || 0; }
      }
    }
    const at = this.rank(from);
    for (const id of this.order) {
      if (enough()) break;
      if (this.rank(id) <= at || !this.speakable(id)) continue;
      const line = this.clips.get(id);
      if (!line) continue;
      for (const part of [...line.got.keys()].sort((x, y) => x - y)) {
        const c = line.got.get(part)!;
        out.push(c);
        secs += c.durationS || 0;
      }
    }
    return out;
  }

  private warm(from: number, withFrom = false) {
    if (this.readAhead <= 0) return;
    this.prefetch.want(this.upcoming(from, withFrom).map((c) => c.src));
  }

  private srcOf(c: VoiceClip): string { return this.prefetch.urlFor(c.src); }

  private failed(id: number, e: unknown) {
    if (this.loading !== id) return;
    this.loading = null;
    const c = this.clips.get(id)?.got.get(this.currentPart);
    if (c) this.prefetch.forget(c.src);
    if (c && this.playing && this.current === id && (this.retries.get(id) ?? 0) < ClipQueue.RETRIES) {
      void this.classify(id, c.src);
      return;
    }
    this.onError(e);
    this.drop(id);
  }

  private async classify(id: number, src: string) {
    let again = false;
    let ready = false;
    let afterMs: number | null = null;
    try {
      const r = await fetch(src, { method: 'GET' });
      ready = r.ok;
      again = r.status === 202 || r.status === 503 || r.status === 429;
      const body = r.status === 503 ? await r.json().catch(() => null) : null;
      afterMs = startingRetryMs(r.status, r.headers.get('Retry-After'), body);
    } catch {
      again = true;
    }
    if (this.current !== id || !this.playing) return;
    if (ready) { this.retries.set(id, (this.retries.get(id) ?? 0) + 1); this.start(id); return; }
    if (!again) { this.drop(id); return; }
    if (afterMs != null) {
      const since = this.startingSince.get(id) ?? Date.now();
      this.startingSince.set(id, since);
      if (Date.now() - since < ClipQueue.STARTING_MS) {
        this.onStarting(since);
        this.retryTimer = setTimeout(() => { if (this.playing && this.current === id) this.start(id); }, afterMs);
        return;
      }
      this.startingSince.delete(id);
      this.playing = false;
      this.onStarting(null);
      this.onWaiting(null);
      this.onError(new VoiceNotStarted());
      this.onSentence(id);
      return;
    }
    const tries = (this.retries.get(id) ?? 0) + 1;
    this.retries.set(id, tries);
    this.retryTimer = setTimeout(() => { if (this.playing && this.current === id) this.start(id); }, ClipQueue.RETRY_MS * tries);
  }

  private drop(id: number) {
    this.onWaiting(null);
    this.onStarting(null);
    this.retries.delete(id);
    this.startingSince.delete(id);
    this.clips.delete(id);
    this.order = [...this.clips.keys()].sort((a, b) => this.rank(a) - this.rank(b));
    if (this.current !== id) return;
    this.finishLine(id);
    if (!this.playing) { this.onSentence(null); return; }
    this.follow();
  }

  position(): { sentenceId: number; t: number; dur: number } | null {
    const el = this.el;
    if (!el || this.current == null || el.ended) return null;
    const known = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    const line = this.clips.get(this.current);
    const piece = known || line?.got.get(this.currentPart)?.durationS || 0;
    let total = 0;
    if (line) for (const [i, c] of line.got) total += (i === this.currentPart ? piece : c.durationS) || 0;
    return { sentenceId: this.current, t: this.partBase + el.currentTime, dur: total || piece };
  }

  private element(): HTMLMediaElement {
    if (this.el) return this.el;
    const el = newMediaElement();
    el.preload = 'auto';
    const tagged = el as HTMLMediaElement & { dataset?: DOMStringMap };
    if (tagged.dataset) tagged.dataset.vsVoice = '1';
    (el as HTMLMediaElement & { playsInline?: boolean }).playsInline = true;
    el.onplaying = () => {
      this.onWaiting(null);
      this.onStarting(null);
      if (this.current != null) this.startingSince.delete(this.current);
      if (this.current == null) return;
      this.retries.delete(this.current);
      this.warm(this.current);
    };
    el.onended = () => {
      this.loading = null;
      if (!this.playing) return;
      const id = this.current;
      const line = id == null ? null : this.clips.get(id);
      if (id != null && line) {
        this.partBase += Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : line.got.get(this.currentPart)?.durationS ?? 0;
        const next = this.currentPart + 1;
        if (next < line.total) { this.startPart(id, next); return; }
        this.finishLine(id);
      }
      this.follow();
    };
    el.onerror = () => { if (this.loading != null && el.error) this.failed(this.loading, el.error); };
    this.el = el;
    return el;
  }

  resync() {
    let dropped = false;
    for (const id of [...this.clips.keys()]) {
      if (this.speakable(id)) continue;
      this.clips.delete(id);
      dropped = true;
    }
    if (!dropped) return;
    this.order = [...this.clips.keys()].sort((a, b) => this.rank(a) - this.rank(b));
    if (this.awaiting && !this.speakable(this.awaiting.id)) {
      const w = this.awaiting.id;
      this.stopWaiting();
      this.finishLine(w);
      this.onWaiting(null);
      if (this.playing) this.follow();
    }
    const cur = this.current;
    if (cur == null || this.clips.has(cur)) return;
    this.el?.pause();
    this.finishLine(cur);
    if (this.playing) { this.follow(); return; }
    this.onSentence(null);
  }

  clear() {
    this.clearRest();
    this.el?.pause();
    this.loading = null;
    this.clips.clear();
    this.order = [];
    this.current = null;
    this.currentPart = 0;
    this.partBase = 0;
    this.stopWaiting();
    this.prefetch.clear();
    this.onWaiting(null);
    this.onSentence(null);
  }

  stop() {
    this.clearRest();
    this.lastDone = null;
    const el = this.el;
    this.onWaiting(null);
    this.onStarting(null);
    this.playing = false;
    this.current = null;
    this.currentPart = 0;
    this.partBase = 0;
    this.loading = null;
    this.floor = 0;
    this.lastRead = null;
    this.started = false;
    this.stopWaiting();
    this.spoken.clear();
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    this.retries.clear();
    this.prefetch.clear();
    if (el) { el.pause(); el.removeAttribute('src'); el.load(); }
    this.el = null;
  }
}
