export interface ClockEl {
  preload: string;
  currentTime: number;
  readonly readyState: number;
  readonly paused: boolean;
  readonly ended: boolean;
  play(): Promise<void>;
  pause(): void;
  onplay: ((this: any, ev: any) => any) | null;
  onpause: ((this: any, ev: any) => any) | null;
  onended: ((this: any, ev: any) => any) | null;
  onwaiting: ((this: any, ev: any) => any) | null;
  onstalled: ((this: any, ev: any) => any) | null;
  onplaying: ((this: any, ev: any) => any) | null;
  oncanplay: ((this: any, ev: any) => any) | null;
  onloadedmetadata: ((this: any, ev: any) => any) | null;
  onerror: ((this: any, ev: any) => any) | null;
}

export interface Want { t: number; playing: boolean; asked?: boolean }

export interface ClockEvents<E extends ClockEl> {
  make(url: string): E;
  prepare?(el: E): void;
  offset(): number;
  playing(on: boolean): void;
  buffering(on: boolean): void;
  ready(on: boolean): void;
  at(t: number): void;
  playError(e: unknown, w: Want): void;
  failed(el: E, url: string): void;
  swapped?(el: E | null): void;
}

const CRED_PARAMS = ['access_token', 'media', 'listenerToken'];

export function mediaKey(url: string | null): string | null {
  if (!url) return null;
  const i = url.indexOf('?');
  if (i < 0) return url;
  const q = new URLSearchParams(url.slice(i + 1));
  for (const k of CRED_PARAMS) q.delete(k);
  const rest = q.toString();
  return url.slice(0, i) + (rest ? `?${rest}` : '');
}

export class ClockMedia<E extends ClockEl = ClockEl> {
  el: E | null = null;
  private key: string | null = null;
  private url: string | null = null;
  private built: string | null = null;
  private want: Want | null = null;
  private lost: Want | null = null;
  private on = false;
  private t = 0;

  private ev: ClockEvents<E>;

  constructor(ev: ClockEvents<E>) { this.ev = ev; }

  get latest(): string | null { return this.url; }
  get loadedFrom(): string | null { return this.built; }
  get pending(): Want | null { return this.want; }

  use(url: string | null): boolean {
    this.url = url;
    if (mediaKey(url) === this.key && (this.el || !url)) return false;
    return this.load();
  }

  reload(): boolean {
    return this.load();
  }

  private load(): boolean {
    const url = this.url;
    this.key = mediaKey(url);
    this.release();
    if (!url) {
      this.want = null;
      this.built = null;
      this.setOn(false);
      this.ev.swapped?.(null);
      return true;
    }
    const a = this.ev.make(url);
    this.built = url;
    a.preload = 'metadata';
    this.ev.prepare?.(a);
    this.ev.ready(false);
    this.ev.at(this.want?.t ?? 0);
    if (this.want) this.t = this.want.t;
    a.onplay = () => { if (this.el === a) this.setOn(true); };
    a.onpause = () => { if (this.el !== a) return; this.setOn(false); this.ev.buffering(false); };
    a.onended = () => { if (this.el !== a) return; this.setOn(false); this.ev.buffering(false); };
    a.onwaiting = () => this.ev.buffering(true);
    a.onstalled = () => { if (!a.paused && a.readyState < 3) this.ev.buffering(true); };
    a.onplaying = () => this.ev.buffering(false);
    a.oncanplay = () => this.ev.buffering(false);
    a.onloadedmetadata = () => {
      if (this.el !== a) return;
      const w = this.want;
      this.want = null;
      this.lost = null;
      this.ev.ready(true);
      a.currentTime = (w?.t ?? 0) + this.ev.offset();
      if (w?.playing) {
        this.setOn(true);
        void a.play().catch((e) => { if (this.el !== a) return; this.setOn(false); this.ev.playError(e, w); });
      }
    };
    a.onerror = () => {
      if (this.el !== a) return;
      this.lost = this.want ?? { t: this.position() ?? this.t, playing: this.on };
      this.setOn(false);
      this.ev.failed(a, url);
    };
    this.el = a;
    this.ev.swapped?.(a);
    return true;
  }

  private release(): void {
    const a = this.el;
    if (!a) {
      if (!this.want && this.lost) this.want = this.lost;
      this.lost = null;
      return;
    }
    this.want = this.want ?? this.lost ?? { t: this.position() ?? this.t, playing: this.on };
    this.lost = null;
    a.onplay = a.onpause = a.onended = a.onloadedmetadata = a.onerror = a.onwaiting = a.onstalled = a.onplaying = a.oncanplay = null;
    a.pause();
    this.el = null;
    this.ev.buffering(false);
  }

  forget(): void {
    const lost = this.lost;
    this.release();
    this.lost = this.want ?? lost;
    this.want = null;
    this.ev.swapped?.(null);
  }

  close(): void {
    this.release();
    this.want = null;
    this.lost = null;
    this.key = null;
    this.ev.swapped?.(null);
  }

  position(): number | null {
    const a = this.el;
    if (!a || this.want || a.readyState < 1) return null;
    const at = a.currentTime - this.ev.offset();
    this.t = at;
    return at;
  }

  seek(s: number): void {
    this.t = s;
    const a = this.el;
    if (a && !this.want && a.readyState >= 1) { a.currentTime = s + this.ev.offset(); return; }
    if (this.want) this.want = { ...this.want, t: s };
    else if (this.lost) this.lost = { ...this.lost, t: s };
    else if (a) this.want = { t: s, playing: this.on };
  }

  ask(t: number): void {
    this.want = this.want?.asked ? null : { t, playing: true, asked: true };
  }

  play(): Promise<void> {
    const a = this.el;
    if (!a) return Promise.resolve();
    if (this.want) { this.want = { ...this.want, playing: true }; this.setOn(true); return Promise.resolve(); }
    return a.play();
  }

  pause(): void {
    if (this.want?.asked && !this.el) this.want = null;
    else if (this.want) { this.want = { ...this.want, playing: false }; this.setOn(false); }
    this.el?.pause();
  }

  private setOn(v: boolean): void {
    this.on = v;
    this.ev.playing(v);
  }
}
