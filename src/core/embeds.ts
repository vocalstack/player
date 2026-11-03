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
      return `https://www.facebook.com/plugins/video.php?${new URLSearchParams({ href: raw, autoplay: String(!!at.play), mute: '1', show_text: 'false', show_captions: 'false' })}`;
    case 'tiktok': {
      const m = /\/video\/(\d+)/.exec(u(raw)?.pathname ?? '');
      return m ? `https://www.tiktok.com/embed/v2/${m[1]}?${new URLSearchParams({ autoplay: String(play), muted: '1', controls: '0' })}` : null;
    }
    case 'x': {
      const m = /\/status(?:es)?\/(\d+)/.exec(u(raw)?.pathname ?? '');
      return m ? `https://platform.twitter.com/embed/Tweet.html?${new URLSearchParams({ id: m[1], theme: 'dark', dnt: 'true' })}` : null;
    }
    case 'instagram': {
      const m = /\/(?:p|reel|reels|tv)\/([\w-]+)/.exec(u(raw)?.pathname ?? '');
      return m ? `https://www.instagram.com/p/${m[1]}/embed` : null;
    }
    case 'kick': {
      const name = u(raw)?.pathname.split('/').filter(Boolean)[0];
      return name ? `https://player.kick.com/${encodeURIComponent(name.toLowerCase())}?${new URLSearchParams({ autoplay: String(!!at.play), muted: 'true' })}` : null;
    }
    case 'ted': {
      const m = /\/talks\/([\w-]+)/.exec(u(raw)?.pathname ?? '');
      return m ? `https://embed.ted.com/talks/${m[1]}` : null;
    }
    case 'wistia': {
      const x = u(raw);
      const m = /\/(?:medias|embed\/iframe|embed\/medias)\/([a-z0-9]+)/i.exec(x?.pathname ?? '') ?? (x && /(^|\.)wi\.st$/i.test(x.hostname) ? /\/([a-z0-9]+)/i.exec(x.pathname) : null);
      return m ? `https://fast.wistia.net/embed/iframe/${m[1]}?${new URLSearchParams({ autoPlay: String(!!at.play), muted: 'true', playbar: 'false', controlsVisibleOnLoad: 'false', time: String(secs(at.t)) })}` : null;
    }
    case 'vidyard': {
      const m = /\/(?:watch\/)?([A-Za-z0-9_-]{16,})(?:\.html)?\/?$/.exec(u(raw)?.pathname ?? '');
      return m ? `https://play.vidyard.com/${m[1]}.html?${new URLSearchParams({ autoplay: String(play), muted: '1', hidden_controls: '1' })}` : null;
    }
    case 'archive': {
      const m = /\/(?:details|embed)\/([^/?#]+)/.exec(u(raw)?.pathname ?? '');
      return m ? `https://archive.org/embed/${m[1]}` : null;
    }
    case 'odysee': {
      const x = u(raw);
      const path = x?.pathname.replace(/^\/\$\/embed\//, '/').replace(/^\//, '');
      return path && path.includes(':') ? `https://odysee.com/$/embed/${path}?${new URLSearchParams({ autoplay: 'false', t: String(secs(at.t)) })}` : null;
    }
    case 'bluesky': {
      const m = /\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(u(raw)?.pathname ?? '');
      return m ? `https://embed.bsky.app/embed/${m[1]}/app.bsky.feed.post/${m[2]}` : null;
    }
    case 'gdrive': {
      const x = u(raw);
      const id = /\/file\/d\/([\w-]+)/.exec(x?.pathname ?? '')?.[1] ?? x?.searchParams.get('id');
      return id ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
    case 'streamable': {
      const id = u(raw)?.pathname.split('/').filter(Boolean).pop();
      return id ? `https://streamable.com/e/${id}?${new URLSearchParams({ autoplay: String(play), muted: '1', nocontrols: '1' })}${at.t ? `#t=${secs(at.t)}` : ''}` : null;
    }
    default:
      return null;
  }
}

export function hasEmbed(raw: string | null | undefined): boolean {
  return !!raw && embedUrl(raw, { t: 0, play: false, host: 'localhost' }) != null;
}

export function urlFromEmbed(site: string | null | undefined, id: string | null | undefined): string | null {
  const v = id?.trim();
  if (!site || !v) return null;
  switch (site) {
    case 'loom': return /^[0-9a-f]{32}$/i.test(v) ? `https://www.loom.com/share/${v}` : null;
    case 'vimeo': return /^\d+(\/[0-9a-z]+)?$/i.test(v) ? `https://vimeo.com/${v}` : null;
    case 'dailymotion': return /^[a-z0-9]+$/i.test(v) ? `https://www.dailymotion.com/video/${v}` : null;
    case 'youtube': return /^[\w-]{6,}$/.test(v) ? `https://www.youtube.com/watch?v=${v}` : null;
    case 'tiktok': return /^\d+$/.test(v) ? `https://www.tiktok.com/@_/video/${v}` : null;
    case 'x': return /^\d+$/.test(v) ? `https://x.com/i/status/${v}` : null;
    case 'instagram': return /^[\w-]+$/.test(v) ? `https://www.instagram.com/p/${v}/` : null;
    case 'kick': return v.startsWith('channel:') ? `https://kick.com/${encodeURIComponent(v.slice(8))}` : null;
    case 'streamable': return /^\w+$/.test(v) ? `https://streamable.com/${v}` : null;
    case 'facebook': return /^\d+$/.test(v) ? `https://www.facebook.com/watch/?v=${v}` : null;
    case 'ted': return /^[\w-]+$/.test(v) ? `https://www.ted.com/talks/${v}` : null;
    case 'wistia': return /^[a-z0-9]+$/i.test(v) ? `https://fast.wistia.net/embed/iframe/${v}` : null;
    case 'vidyard': return /^[\w-]{16,}$/.test(v) ? `https://play.vidyard.com/${v}.html` : null;
    case 'archive': return /^[^/?#\s]+$/.test(v) ? `https://archive.org/details/${v}` : null;
    case 'odysee': return /^[^?#\s]+:[^?#\s]+$/.test(v) ? `https://odysee.com/${v}` : null;
    case 'bluesky': return /^[^/\s]+\/[^/\s]+$/.test(v) ? `https://bsky.app/profile/${v.split('/')[0]}/post/${v.split('/')[1]}` : null;
    case 'gdrive': return /^[\w-]+$/.test(v) ? `https://drive.google.com/file/d/${v}/view` : null;
    case 'twitch':
      if (/^v\d+$/.test(v)) return `https://www.twitch.tv/videos/${v.slice(1)}`;
      if (v.startsWith('clip:')) return `https://clips.twitch.tv/${encodeURIComponent(v.slice(5))}`;
      if (v.startsWith('channel:')) return `https://www.twitch.tv/${encodeURIComponent(v.slice(8))}`;
      return null;
    default: return null;
  }
}

export function sourceVideoUrl(src: { kind?: string; url?: string | null; site?: string | null; embedId?: string | null } | null | undefined): string | null {
  if (!src || src.kind !== 'url') return null;
  return urlFromEmbed(src.site, src.embedId) ?? src.url ?? null;
}
