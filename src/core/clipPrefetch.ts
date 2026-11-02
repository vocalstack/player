export type Fetcher = (src: string, signal: AbortSignal) => Promise<{ ok: boolean; status: number; blob: () => Promise<Blob> }>;

type Entry = { state: 'loading'; ctl: AbortController } | { state: 'ready'; url: string } | { state: 'failed'; at: number };

export interface PrefetchOptions {
  fetcher?: Fetcher;
  concurrency?: number;
  keep?: number;
  retryMs?: number;
  now?: () => number;
  toUrl?: (b: Blob) => string;
  revoke?: (url: string) => void;
}

export class ClipPrefetch {
  private entries = new Map<string, Entry>();
  private wanted: string[] = [];
  private used: string[] = [];
  private readonly fetcher: Fetcher | null;
  private readonly concurrency: number;
  private readonly keep: number;
  private readonly retryMs: number;
  private readonly now: () => number;
  private readonly toUrl: (b: Blob) => string;
  private readonly revoke: (url: string) => void;
  onReady: (src: string) => void = () => {};

  constructor(o: PrefetchOptions = {}) {
    this.fetcher = o.fetcher ?? (typeof fetch === 'function' ? (src, signal) => fetch(src, { signal }) : null);
    this.concurrency = Math.max(1, o.concurrency ?? 2);
    this.keep = Math.max(2, o.keep ?? 24);
    this.retryMs = o.retryMs ?? 4000;
    this.now = o.now ?? (() => Date.now());
    this.toUrl = o.toUrl ?? ((b) => URL.createObjectURL(b));
    this.revoke = o.revoke ?? ((u) => { try { URL.revokeObjectURL(u); } catch { } });
  }

  want(srcs: string[]) {
    this.wanted = [...new Set(srcs)];
    const keepSet = new Set(this.wanted);
    for (const [src, e] of this.entries) {
      if (e.state === 'loading' && !keepSet.has(src)) {
        e.ctl.abort();
        this.entries.delete(src);
      }
    }
    this.evict(keepSet);
    this.pump();
  }

  urlFor(src: string): string {
    const e = this.entries.get(src);
    if (e?.state !== 'ready') return src;
    this.used = [src, ...this.used.filter((s) => s !== src)];
    return e.url;
  }

  ready(src: string): boolean { return this.entries.get(src)?.state === 'ready'; }

  loading(): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.state === 'loading') n++;
    return n;
  }

  forget(src: string) {
    const e = this.entries.get(src);
    if (!e) return;
    if (e.state === 'loading') e.ctl.abort();
    if (e.state === 'ready') this.revoke(e.url);
    this.entries.delete(src);
  }

  clear() {
    for (const src of [...this.entries.keys()]) this.forget(src);
    this.wanted = [];
    this.used = [];
  }

  private evict(keepSet: Set<string>) {
    const ready = [...this.entries].filter(([, e]) => e.state === 'ready').map(([s]) => s);
    if (ready.length <= this.keep) return;
    const recent = new Set(this.used.slice(0, 2));
    const spare = ready.filter((s) => !keepSet.has(s) && !recent.has(s));
    const order = spare.sort((a, b) => this.usedRank(b) - this.usedRank(a));
    let over = ready.length - this.keep;
    for (const s of order) {
      if (over <= 0) break;
      this.forget(s);
      over--;
    }
  }

  private usedRank(src: string): number {
    const i = this.used.indexOf(src);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  }

  private pump() {
    if (!this.fetcher) return;
    let busy = this.loading();
    for (const src of this.wanted) {
      if (busy >= this.concurrency) return;
      const e = this.entries.get(src);
      if (e?.state === 'loading' || e?.state === 'ready') continue;
      if (e?.state === 'failed' && this.now() - e.at < this.retryMs) continue;
      busy++;
      this.load(src);
    }
  }

  private load(src: string) {
    const ctl = new AbortController();
    this.entries.set(src, { state: 'loading', ctl });
    const done = (e: Entry | null) => {
      const cur = this.entries.get(src);
      if (cur?.state !== 'loading' || cur.ctl !== ctl) {
        if (e?.state === 'ready') this.revoke(e.url);
        return;
      }
      if (e) this.entries.set(src, e); else this.entries.delete(src);
      if (e?.state === 'ready') this.onReady(src);
      this.evict(new Set(this.wanted));
      this.pump();
    };
    this.fetcher!(src, ctl.signal)
      .then(async (r) => {
        if (!r.ok) { done({ state: 'failed', at: this.now() }); return; }
        const b = await r.blob();
        done(b.size > 0 ? { state: 'ready', url: this.toUrl(b) } : { state: 'failed', at: this.now() });
      })
      .catch(() => done(ctl.signal.aborted ? null : { state: 'failed', at: this.now() }));
  }
}
