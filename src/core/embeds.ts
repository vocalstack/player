import { siteOf } from './sites';

export interface EmbedAt { t: number; play: boolean; host?: string }

function u(raw: string): URL | null {
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
}

const secs = (t: number) => Math.max(0, Math.floor(t));

export function loomId(raw: string): string | null {
  const m = /\/(?:share|embed)\/(?:[^/?#]*-)?([0-9a-f]{32})(?:[/?#]|$)/i.exec(u(raw)?.pathname ?? '');
  return m ? m[1].toLowerCase() : null;
}

export function vimeoIds(raw: string): { id: string; h: string | null } | null {
  const x = u(raw);
  if (!x) return null;
  const parts = x.pathname.split('/').filter(Boolean);
  const at = parts.map((p, i) => (/^\d+$/.test(p) ? i : -1)).filter((i) => i >= 0).pop();
  if (at == null) return null;
  const next = parts[at + 1];
  return { id: parts[at], h: x.searchParams.get('h') ?? (next && /^[0-9a-f]{6,}$/i.test(next) ? next : null) };
}

export function dailymotionId(raw: string): string | null {
  const x = u(raw);
  if (!x) return null;
  if (/(^|\.)dai\.ly$/i.test(x.hostname)) return x.pathname.split('/').filter(Boolean)[0] ?? null;
  const m = /\/video\/([a-z0-9]+)/i.exec(x.pathname);
  return m ? m[1] : null;
}

export function twitchTarget(raw: string): { video?: string; channel?: string; clip?: string } | null {
  const x = u(raw);
  if (!x) return null;
  const parts = x.pathname.split('/').filter(Boolean);
  if (/^clips\.twitch\.tv$/i.test(x.hostname)) return parts[0] ? { clip: parts[0] } : null;
  const v = parts.indexOf('videos');
  if (v >= 0 && parts[v + 1]) return { video: parts[v + 1].replace(/^v/, '') };
  const c = parts.indexOf('clip');
  if (c >= 0 && parts[c + 1]) return { clip: parts[c + 1] };
  return parts[0] ? { channel: parts[0] } : null;
}

const hms = (t: number) => { const s = secs(t); return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m${s % 60}s`; };

export function embedUrl(raw: string, at: EmbedAt): string | null {
  const site = siteOf(raw);
  if (!site) return null;
  const play = at.play ? 1 : 0;
  switch (site.id) {
    case 'loom': {
      const id = loomId(raw);
      if (!id) return null;
      const q = new URLSearchParams({ hide_owner: 'true', hide_share: 'true', hide_title: 'true', hideEmbedTopBar: 'true', hide_speed: 'true', muted: 'true', autoplay: at.play ? 'true' : 'false', t: String(secs(at.t)) });
      return `https://www.loom.com/embed/${id}?${q}`;
    }
    case 'vimeo': {
      const v = vimeoIds(raw);
      if (!v) return null;
      const q = new URLSearchParams({ autoplay: String(play), muted: '1', controls: '0', title: '0', byline: '0', portrait: '0', dnt: '1' });
      if (v.h) q.set('h', v.h);
      return `https://player.vimeo.com/video/${v.id}?${q}#t=${secs(at.t)}s`;
    }
    case 'dailymotion': {
      const id = dailymotionId(raw);
      if (!id) return null;
      const q = new URLSearchParams({ autoplay: String(play), mute: '1', controls: '0', 'queue-enable': '0', 'sharing-enable': '0', 'ui-start-screen-info': '0', start: String(secs(at.t)) });
      return `https://www.dailymotion.com/embed/video/${id}?${q}`;
    }
    case 'twitch': {
      const tg = twitchTarget(raw);
      if (!tg || !at.host) return null;
      if (tg.clip) return `https://clips.twitch.tv/embed?${new URLSearchParams({ clip: tg.clip, parent: at.host, autoplay: String(!!at.play), muted: 'true' })}`;
      const q = new URLSearchParams({ parent: at.host, autoplay: String(!!at.play), muted: 'true' });
      if (tg.video) { q.set('video', `v${tg.video}`); q.set('time', hms(at.t)); } else if (tg.channel) q.set('channel', tg.channel);
      return `https://player.twitch.tv/?${q}`;
    }
    case 'facebook':
      return `https://www.facebook.com/plugins/video.php?${new URLSearchParams({ href: raw, autoplay: String(!!at.play), mute: '1', show_text: 'false' })}`;
    default:
      return null;
  }
}

export function hasEmbed(raw: string | null | undefined): boolean {
  return !!raw && embedUrl(raw, { t: 0, play: false, host: 'localhost' }) != null;
}
