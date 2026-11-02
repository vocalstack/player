export const DEFAULT_APP = 'https://app.vocalstack.com';
const PATH = '/connect/transcribe';

export interface Started { transcriptionId: string; recordingId: string; token: string; expiresAt: string | null }

export type PopupStatus = 'signing-in' | 'consent' | 'looking' | 'confirm' | 'checking' | 'starting';

function nonce(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function openPopup(appUrl: string | undefined, ask: { url?: string; transcription?: string; ask?: boolean; connect?: boolean }, onStatus?: (s: PopupStatus) => void): Promise<Started | 'connected' | null> {
  const app = new URL(appUrl ?? DEFAULT_APP);
  const n = nonce();
  const u = new URL(PATH, app);
  if (ask.url) u.searchParams.set('url', ask.url);
  if (ask.transcription) u.searchParams.set('transcription', ask.transcription);
  if (ask.ask) u.searchParams.set('ask', '1');
  if (ask.connect) u.searchParams.set('connect', '1');
  u.searchParams.set('origin', window.location.origin);
  u.searchParams.set('nonce', n);
  const w = 480, h = 640;
  const left = Math.max(0, (window.screenX ?? 0) + ((window.outerWidth ?? w) - w) / 2);
  const top = Math.max(0, (window.screenY ?? 0) + ((window.outerHeight ?? h) - h) / 2);
  const pop = window.open(u.toString(), 'vocalstack-connect', `popup=yes,width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)}`);
  if (!pop) return Promise.reject(new Error('Your browser blocked the VocalStack window. Allow pop-ups for this site and try again.'));
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => { if (done) return; done = true; window.removeEventListener('message', on); clearInterval(watch); fn(); };
    const on = (ev: MessageEvent) => {
      if (ev.origin !== app.origin || ev.source !== pop) return;
      const d = ev.data as { source?: string; type?: string; nonce?: string; [k: string]: any } | null;
      if (!d || d.source !== 'vocalstack' || d.nonce !== n) return;
      if (d.type === 'vocalstack:hello') { pop.postMessage({ source: 'vocalstack', type: 'vocalstack:hello-ack', nonce: n }, app.origin); return; }
      if (d.type === 'vocalstack:status') { onStatus?.(d.status); return; }
      if (d.type === 'vocalstack:started' || d.type === 'vocalstack:token' || d.type === 'vocalstack:found') {
        finish(() => resolve({ transcriptionId: String(d.transcriptionId), recordingId: String(d.recordingId), token: String(d.token), expiresAt: d.expiresAt ?? null }));
        return;
      }
      if (d.type === 'vocalstack:connected') { finish(() => resolve('connected')); return; }
      if (d.type === 'vocalstack:declined') { finish(() => resolve(null)); return; }
      if (d.type === 'vocalstack:error') finish(() => reject(new Error(typeof d.message === 'string' && d.message ? d.message : 'VocalStack could not start this transcription.')));
    };
    window.addEventListener('message', on);
    const watch = setInterval(() => { if (pop.closed) finish(() => resolve(null)); }, 500);
  });
}

export async function startFromEmbed(appUrl: string | undefined, url: string, onStatus?: (s: PopupStatus) => void): Promise<Started | null> {
  const r = await openPopup(appUrl, { url }, onStatus);
  return r === 'connected' ? null : r;
}

const CONNECTED = 'vsp.connected';

export function wasConnected(appUrl: string | undefined): boolean {
  try { return localStorage.getItem(CONNECTED) === new URL(appUrl ?? DEFAULT_APP).origin; } catch { return false; }
}

export function rememberConnected(appUrl: string | undefined): void {
  try { localStorage.setItem(CONNECTED, new URL(appUrl ?? DEFAULT_APP).origin); } catch { }
}
