let reporter: ((e: Error) => void) | null = null;

export function setErrorReporter(fn: ((e: Error) => void) | null): void {
  reporter = fn;
}

export function reportError(e: Error): void {
  reporter?.(e);
}

export function liveAudioSupported(): boolean {
  return typeof (window as any).AudioDecoder === 'function' && typeof AudioContext === 'function';
}

class OggDemux {
  private buf = new Uint8Array(0);
  private pending: Uint8Array[] = [];
  private partial: Uint8Array | null = null;

  push(chunk: Uint8Array): Uint8Array[] {
    const joined = new Uint8Array(this.buf.length + chunk.length);
    joined.set(this.buf);
    joined.set(chunk, this.buf.length);
    this.buf = joined;
    const out: Uint8Array[] = [];
    for (;;) {
      const page = this.readPage();
      if (!page) break;
      out.push(...page);
    }
    return out;
  }

  private readPage(): Uint8Array[] | null {
    const b = this.buf;
    if (b.length < 27) return null;
    let start = 0;
    while (start + 27 <= b.length && !(b[start] === 0x4f && b[start + 1] === 0x67 && b[start + 2] === 0x67 && b[start + 3] === 0x53)) start++;
    if (start + 27 > b.length) {
      this.buf = b.subarray(start);
      return null;
    }
    const segCount = b[start + 26];
    const headerLen = 27 + segCount;
    if (start + headerLen > b.length) return null;
    const lacing = b.subarray(start + 27, start + headerLen);
    let bodyLen = 0;
    for (const l of lacing) bodyLen += l;
    if (start + headerLen + bodyLen > b.length) return null;
    const body = b.subarray(start + headerLen, start + headerLen + bodyLen);
    this.buf = b.subarray(start + headerLen + bodyLen);
    const packets: Uint8Array[] = [];
    let off = 0;
    let cur: Uint8Array[] = this.partial ? [this.partial] : [];
    this.partial = null;
    for (const l of lacing) {
      cur.push(body.subarray(off, off + l));
      off += l;
      if (l < 255) {
        packets.push(concat(cur));
        cur = [];
      }
    }
    if (cur.length) this.partial = concat(cur);
    return packets;
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export class LivePlayer {
  private ctx: AudioContext | null = null;
  private decoder: any = null;
  private demux = new OggDemux();
  private nextTime = 0;
  private gain: GainNode | null = null;
  private headerSeen = false;
  private ts = 0;
  volume = 1;

  async start() {
    if (!liveAudioSupported()) throw new Error('Live audio needs WebCodecs (AudioDecoder)');
    this.ctx = new AudioContext({ sampleRate: 48000 });
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.gain.connect(this.ctx.destination);
    await this.ctx.resume();
    const AD = (window as any).AudioDecoder;
    this.decoder = new AD({
      output: (data: any) => this.play(data),
      error: (e: unknown) => console.warn('opus decode', e),
    });
    this.decoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1 });
    this.nextTime = this.ctx.currentTime + 0.15;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.gain) this.gain.gain.value = v;
  }

  feed(bytes: ArrayBuffer) {
    if (!this.decoder) return;
    for (const pkt of this.demux.push(new Uint8Array(bytes))) {
      if (pkt.length >= 8 && pkt[0] === 0x4f && pkt[1] === 0x70 && pkt[2] === 0x75 && pkt[3] === 0x73) {
        this.headerSeen = true;
        continue;
      }
      if (pkt.length === 0) continue;
      const EAC = (window as any).EncodedAudioChunk;
      try {
        this.decoder.decode(new EAC({ type: 'key', timestamp: this.ts, data: pkt }));
        this.ts += 60_000;
      } catch (e) {
        console.warn('decode', e);
      }
    }
  }

  private play(data: any) {
    if (!this.ctx || !this.gain) return;
    const frames = data.numberOfFrames as number;
    const buf = this.ctx.createBuffer(1, frames, data.sampleRate ?? 48000);
    const f32 = new Float32Array(frames);
    data.copyTo(f32, { planeIndex: 0, format: 'f32-planar' });
    buf.getChannelData(0).set(f32);
    data.close();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    const now = this.ctx.currentTime;
    if (this.nextTime < now) this.nextTime = now + 0.05;
    src.start(this.nextTime);
    this.nextTime += buf.duration;
  }

  async stop() {
    try {
      this.decoder?.close();
    } catch {
    }
    this.decoder = null;
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

export function deliveryFormat(): 'ogg' | 'caf' {
  try {
    return document.createElement('audio').canPlayType('audio/x-caf; codecs=opus') === 'probably' ? 'caf' : 'ogg';
  } catch {
    return 'ogg';
  }
}

export interface MediaCred {
  accessToken?: string | null; listenerToken?: string | null; shareCode?: string | null;
  media?: string | null;
}

export function credParams(cred: MediaCred = {}): string {
  const q = new URLSearchParams();
  if (cred.media) q.set('media', cred.media);
  else if (cred.accessToken) q.set('access_token', cred.accessToken);
  if (cred.listenerToken) q.set('listenerToken', cred.listenerToken);
  if (cred.shareCode) q.set('shareCode', cred.shareCode);
  return q.toString();
}

export function audioClipUrl(apiOrigin: string, recordingId: string, startS: number, endS: number, cred: MediaCred = {}, clean = false): string {
  const cp = credParams(cred);
  return `${apiOrigin}/v1/recordings/${recordingId}/audio/clip?startS=${startS.toFixed(2)}&endS=${endS.toFixed(2)}${clean ? '&clean=true' : ''}${cp ? `&${cp}` : ''}`;
}

export async function explainAudioError(url: string): Promise<{ message: string; permanent: boolean } | null> {
  try {
    const res = await fetch(url, { redirect: 'manual', headers: { accept: 'application/json' } });
    if (res.type === 'opaqueredirect' || res.ok || (res.status >= 300 && res.status < 400)) return null;
    let body: any = null;
    try { body = await res.json(); } catch { }
    const message: unknown = body?.message;
    if (typeof message !== 'string' || !message) return null;
    return { message: message[0].toUpperCase() + message.slice(1) + (message.endsWith('.') ? '' : '.'), permanent: res.status === 404 || res.status === 403 };
  } catch {
    return null;
  }
}

export async function audioSealed(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'manual', headers: { accept: 'application/json' } });
    return res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400);
  } catch {
    return false;
  }
}

export function deliveryAudioUrl(apiOrigin: string, recordingId: string, cred: MediaCred = {}): string {
  const q = new URLSearchParams({ kind: 'delivery', format: deliveryFormat() });
  if (cred.media) q.set('media', cred.media);
  else if (cred.accessToken) q.set('access_token', cred.accessToken);
  if (cred.listenerToken) q.set('listenerToken', cred.listenerToken);
  if (cred.shareCode) q.set('shareCode', cred.shareCode);
  return `${apiOrigin}/v1/recordings/${recordingId}/audio?${q}`;
}

export function backgroundAudioUrl(apiOrigin: string, recordingId: string, cred: MediaCred = {}, kind: 'background' | 'speech' = 'background'): string {
  const q = new URLSearchParams({ kind, format: deliveryFormat() });
  if (cred.media) q.set('media', cred.media);
  else if (cred.accessToken) q.set('access_token', cred.accessToken);
  if (cred.listenerToken) q.set('listenerToken', cred.listenerToken);
  if (cred.shareCode) q.set('shareCode', cred.shareCode);
  return `${apiOrigin}/v1/recordings/${recordingId}/audio?${q}`;
}

export function audioDownloadUrl(apiOrigin: string, recordingId: string, kind: 'source' | 'delivery' | 'video', cred: MediaCred = {}): string {
  const q = new URLSearchParams({ kind });
  if (kind === 'delivery') q.set('format', 'mp3');
  if (cred.media) q.set('media', cred.media);
  else if (cred.accessToken) q.set('access_token', cred.accessToken);
  if (cred.listenerToken) q.set('listenerToken', cred.listenerToken);
  if (cred.shareCode) q.set('shareCode', cred.shareCode);
  return `${apiOrigin}/v1/recordings/${recordingId}/audio?${q}`;
}

export function voiceTrackUrl(apiOrigin: string, recordingId: string, lang: string, voiceKey: string, cred: MediaCred = {}): string {
  return voiceTrackUrlAs(apiOrigin, recordingId, lang, voiceKey, deliveryFormat(), cred);
}

export function voiceTrackDownloadUrl(apiOrigin: string, recordingId: string, lang: string, voiceKey: string, cred: MediaCred = {}): string {
  return voiceTrackUrlAs(apiOrigin, recordingId, lang, voiceKey, 'mp3', cred);
}

function voiceTrackUrlAs(apiOrigin: string, recordingId: string, lang: string, voiceKey: string, format: 'ogg' | 'caf' | 'mp3', cred: MediaCred): string {
  const q = new URLSearchParams({ kind: 'voice', lang, format });
  if (voiceKey) q.set('voice', voiceKey);
  if (cred.media) q.set('media', cred.media);
  else if (cred.accessToken) q.set('access_token', cred.accessToken);
  if (cred.listenerToken) q.set('listenerToken', cred.listenerToken);
  if (cred.shareCode) q.set('shareCode', cred.shareCode);
  return `${apiOrigin}/v1/recordings/${recordingId}/audio?${q}`;
}

export function mediaErrorText(e: MediaError | null, report = true): string {
  const code = e?.code ?? 0;
  const what = code === 2 ? 'the download failed' : code === 3 ? 'this browser could not decode it' : code === 4 ? 'the file is not available, or this browser cannot play it' : code === 1 ? 'the load was stopped' : 'something went wrong';
  if (report) reportMediaError(e);
  return `The audio could not be played: ${what}.`;
}

export function reportMediaError(e: MediaError | null, what?: string): void {
  const code = e?.code ?? 0;
  if (code !== 1) reportError(new Error(`media error ${code}${e?.message ? `: ${e.message}` : ''}${what ? ` (${what})` : ''}`));
}

export function mediaKindOf(url: string): string {
  try {
    const u = new URL(url, 'https://x.invalid');
    const q = u.searchParams;
    const tail = u.pathname.split('/').filter(Boolean).slice(-1)[0] ?? '';
    return [q.get('kind') ?? tail, q.get('format'), q.get('lang')].filter(Boolean).join(' ');
  } catch {
    return '';
  }
}
