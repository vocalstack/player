const APP_HOSTS = ['app.vocalstack.com'];
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const TX_PATH = /^\/transcriptions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/r\/[^/]+|\/live)?\/?$/i;

function hostOfApp(appUrl: string | null | undefined): string | null {
  if (!appUrl) return null;
  try { return new URL(appUrl).host.toLowerCase(); } catch { return null; }
}

export function dashboardTxOf(raw: string, appUrl?: string | null): string | null {
  const v = raw.trim();
  if (!v) return null;
  let u: URL;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const name = u.hostname.toLowerCase();
  const known = APP_HOSTS.includes(name) || LOCAL.test(name) || u.host.toLowerCase() === hostOfApp(appUrl);
  if (!known) return null;
  const m = TX_PATH.exec(u.pathname);
  return m ? m[1].toLowerCase() : null;
}
