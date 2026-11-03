import type { FollowSetup } from '../ui/FileFollow';

export async function loomStreamUrl(id: string): Promise<string | null> {
  try {
    const r = await fetch(`https://www.loom.com/api/campaigns/sessions/${id}/raw-url`, { method: 'POST' });
    if (!r.ok || r.status === 204) return null;
    const j = await r.json() as { url?: unknown };
    return typeof j.url === 'string' && /^https:\/\//.test(j.url) ? j.url : null;
  } catch {
    return null;
  }
}

export function signedLoader(master: string) {
  const query = master.includes('?') ? master.slice(master.indexOf('?') + 1) : '';
  return (xhr: XMLHttpRequest, u: string) => { if (query && !u.includes('Signature=')) xhr.open('GET', u + (u.includes('?') ? '&' : '?') + query, true); };
}

export function loomSetup(id: string): FollowSetup {
  return (v, fail) => {
    let live = true;
    let destroy: (() => void) | null = null;
    void (async () => {
      const url = await loomStreamUrl(id);
      if (!live) return;
      if (!url) { fail(); return; }
      const mod = await import('hls.js').catch(() => null);
      if (!live) return;
      const Hls = mod?.default;
      if (!Hls || !Hls.isSupported()) { fail(); return; }
      const hls = new Hls({ xhrSetup: signedLoader(url), capLevelToPlayerSize: true, startLevel: 0, maxBufferLength: 20 });
      hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { hls.destroy(); fail(); } });
      hls.loadSource(url);
      hls.attachMedia(v);
      destroy = () => hls.destroy();
    })();
    return () => { live = false; destroy?.(); };
  };
}
