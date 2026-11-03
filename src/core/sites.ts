export type SiteId = 'youtube' | 'loom' | 'vimeo' | 'twitch' | 'facebook' | 'instagram' | 'dailymotion' | 'tiktok' | 'x' | 'soundcloud' | 'kick' | 'mixcloud' | 'bandcamp' | 'streamable' | 'ted' | 'linkedin' | 'archive' | 'odysee' | 'niconico' | 'vk' | 'bitchute' | 'wistia' | 'vidyard' | 'kaltura' | 'jwplayer' | 'pinterest' | 'bluesky' | 'gdrive' | 'spreaker' | 'iheart' | 'audioboom' | 'cnn';

export interface Site {
  id: SiteId;
  name: string;
  color: string;
  hosts: RegExp;
  glyph: string;
  audioOnly?: boolean;
}

export const SITES: Site[] = [
  { id: 'youtube', name: 'YouTube', color: '#ff3b30', hosts: /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/, glyph: 'M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.1V8.9l5.3 3.1L10 15.1Z' },
  { id: 'loom', name: 'Loom', color: '#8f7bff', hosts: /(^|\.)loom\.com$/, glyph: 'M21 11h-5.2l4.5-2.6-1-1.7-4.5 2.6 2.6-4.5-1.7-1-2.6 4.5V3h-2v5.3L8.5 3.8l-1.7 1 2.6 4.5-4.5-2.6-1 1.7L8.2 11H3v2h5.2l-4.5 2.6 1 1.7 4.5-2.6-2.6 4.5 1.7 1 2.6-4.5V21h2v-5.2l2.6 4.5 1.7-1-2.6-4.5 4.5 2.6 1-1.7-4.5-2.6H21v-2Zm-9 3.4a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z' },
  { id: 'vimeo', name: 'Vimeo', color: '#1ab7ea', hosts: /(^|\.)vimeo\.com$/, glyph: 'M22 7.4c-.1 2-1.5 4.7-4.2 8.1-2.8 3.6-5.1 5.4-7 5.4-1.2 0-2.2-1.1-3-3.3L6.2 11.6C5.6 9.4 5 8.3 4.3 8.3c-.1 0-.6.3-1.4.9L2 8l2.7-2.4C5.9 4.6 6.8 4 7.4 4c1.4-.1 2.3.9 2.6 2.9.4 2.2.6 3.6.8 4.1.4 1.8.9 2.7 1.4 2.7.4 0 1-.6 1.8-1.9.8-1.2 1.2-2.2 1.3-2.8.1-1.1-.3-1.6-1.3-1.6-.5 0-.9.1-1.4.3.9-3 2.7-4.5 5.3-4.4 1.9.1 2.8 1.3 2.7 3.7Z' },
  { id: 'twitch', name: 'Twitch', color: '#a970ff', hosts: /(^|\.)twitch\.tv$/, glyph: 'M5 2.5 3 6.5v13h4.5V22H10l2.5-2.5h3.8L21 14.8V2.5H5Zm14 11.4-2.9 2.9h-4.3L9.4 19.2v-2.4H6V4.5h13v9.4ZM15.2 7.4h1.9v5.2h-1.9V7.4Zm-5 0h1.9v5.2h-1.9V7.4Z' },
  { id: 'facebook', name: 'Facebook', color: '#3b82f6', hosts: /(^|\.)(facebook\.com|fb\.watch|fb\.com)$/, glyph: 'M13.9 21.5v-8h2.7l.4-3.1h-3.1V8.4c0-.9.3-1.5 1.6-1.5H17V4.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H7.9v3.1h2.7v8h3.3Z' },
  { id: 'instagram', name: 'Instagram', color: '#f56aa0', hosts: /(^|\.)instagram\.com$/, glyph: 'M7.5 2.5h9a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5h-9a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5Zm0 1.8a3.2 3.2 0 0 0-3.2 3.2v9a3.2 3.2 0 0 0 3.2 3.2h9a3.2 3.2 0 0 0 3.2-3.2v-9a3.2 3.2 0 0 0-3.2-3.2h-9ZM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1.8a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Zm5.1-3.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z' },
  { id: 'dailymotion', name: 'Dailymotion', color: '#4aa3ff', hosts: /(^|\.)(dailymotion\.com|dai\.ly)$/, glyph: 'M14.6 3.5h3.2V20h-3v-1.2a5.4 5.4 0 0 1-3.6 1.4c-3.3 0-5.9-2.7-5.9-6.1S7.9 8 11.2 8c1.3 0 2.5.4 3.4 1.2V3.5Zm-3.1 7.4a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z' },
  { id: 'tiktok', name: 'TikTok', color: '#25f4ee', hosts: /(^|\.)tiktok\.com$/, glyph: 'M16.6 2.5c.3 2.3 1.7 3.8 3.9 4v2.7a6.8 6.8 0 0 1-3.9-1.3v6.5a5.7 5.7 0 1 1-5.7-5.7l.9.1v2.8a2.9 2.9 0 1 0 2 2.8V2.5h2.8Z' },
  { id: 'x', name: 'X', color: '#e8eaf2', hosts: /(^|\.)(x\.com|twitter\.com)$/, glyph: 'M17.8 3h3.1l-6.7 7.7L22 21h-6.2l-4.8-6.3L5.5 21H2.4l7.2-8.2L2.1 3h6.3l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z' },
  { id: 'soundcloud', name: 'SoundCloud', color: '#ff7a1a', hosts: /(^|\.)soundcloud\.com$/, audioOnly: true, glyph: 'M11 8.6a5 5 0 0 1 7.8 3.1 3 3 0 0 1-.3 6H11V8.6ZM8.6 9.4h1.3v8.3H8.6V9.4Zm-2.4 1.2h1.3v7.1H6.2v-7.1Zm-2.4 1.6h1.3v5.5H3.8v-5.5Zm-2.4 1.6h1.3v3.9H1.4v-3.9Z' },
  { id: 'kick', name: 'Kick', color: '#53fc18', hosts: /(^|\.)kick\.com$/, glyph: 'M4 3h5.5v5H11V6h2V3h5.5v6.5h-2V11h-2v2h2v1.5h2V21H13v-3h-2v-2H9.5v5H4V3Z' },
  { id: 'mixcloud', name: 'Mixcloud', color: '#7f8cff', hosts: /(^|\.)mixcloud\.com$/, audioOnly: true, glyph: 'M17.5 9.5a5.5 5.5 0 0 0-10.6 1.2A3.8 3.8 0 0 0 7.3 18h10.2a4.25 4.25 0 0 0 0-8.5Z' },
  { id: 'streamable', name: 'Streamable', color: '#0f90fa', hosts: /(^|\.)streamable\.com$/, glyph: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm6 2.3v6.4l5.2-3.2L10 8.8Z' },
  { id: 'bandcamp', name: 'Bandcamp', color: '#1da0c3', hosts: /(^|\.)bandcamp\.com$/, audioOnly: true, glyph: 'M2 18 8.5 6H22l-6.5 12H2Z' },
  { id: 'ted', name: 'TED', color: '#e62b1e', hosts: /(^|\.)ted\.com$/, glyph: 'M2 6h6.5v2.3H6.4V18H4V8.3H2V6Zm7.5 0h5.3v2.3h-2.9v2.6h2.6v2.3h-2.6v2.5h2.9V18H9.5V6Zm6.4 0h2.3A3.8 3.8 0 0 1 22 9.8v4.4a3.8 3.8 0 0 1-3.8 3.8h-2.3V6Zm2.4 2.3v7.4c.9 0 1.4-.7 1.4-1.6v-4.2c0-.9-.5-1.6-1.4-1.6Z' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', hosts: /(^|\.)linkedin\.com$/, glyph: 'M5 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5Z' },
  { id: 'archive', name: 'Internet Archive', color: '#c8c8c8', hosts: /(^|\.)archive\.org$/, glyph: 'M3 19h18v2H3v-2Zm1-2h16v1.2H4V17Zm1.5-9h2v8h-2V8Zm5.5 0h2v8h-2V8Zm5.5 0h2v8h-2V8ZM3 5.5 12 3l9 2.5V7H3V5.5Z' },
  { id: 'odysee', name: 'Odysee', color: '#ef1970', hosts: /(^|\.)(odysee\.com|lbry\.tv)$/, glyph: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z' },
  { id: 'niconico', name: 'Niconico', color: '#e6e6e6', hosts: /(^|\.)(nicovideo\.jp|nico\.ms)$/, glyph: 'M4 8h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm3.5-5L11 7H9.3L6.5 4.2 7.5 3Zm9 0 1 1.2L14.7 7H13l3.5-4Z' },
  { id: 'vk', name: 'VK', color: '#0077ff', hosts: /(^|\.)(vk\.com|vkvideo\.ru)$/, glyph: 'M12.8 17.5c-5.5 0-8.6-3.8-8.8-10h2.8c.1 4.6 2.1 6.5 3.7 6.9V7.5h2.6v3.9c1.6-.2 3.3-2 3.8-3.9h2.6c-.4 2.4-2.2 4.2-3.4 4.9 1.3.6 3.3 2.1 4.1 5.1h-2.9c-.6-1.9-2.2-3.4-4.2-3.6v3.6h-.3Z' },
  { id: 'bitchute', name: 'BitChute', color: '#ef4137', hosts: /(^|\.)bitchute\.com$/, glyph: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm-2 5.5v7l6-3.5-6-3.5Z' },
  { id: 'wistia', name: 'Wistia', color: '#54bbff', hosts: /(^|\.)(wistia\.com|wistia\.net|wi\.st)$/, glyph: 'M3 7h13l-2.5 4H3V7Zm0 6h15.5L21 9v4.5L18.5 17H3v-4Z' },
  { id: 'vidyard', name: 'Vidyard', color: '#38c172', hosts: /(^|\.)vidyard\.com$/, glyph: 'M3 5h4l5 9 5-9h4l-9 15L3 5Z' },
  { id: 'kaltura', name: 'Kaltura', color: '#00a8e1', hosts: /(^|\.)kaltura\.com$/, glyph: 'M5 4h3v7l6-7h4l-6.5 7.3L18.5 20h-4l-5-6.4L8 15.3V20H5V4Z' },
  { id: 'jwplayer', name: 'JW Player', color: '#ff0046', hosts: /(^|\.)(jwplayer\.com|jwplatform\.com)$/, glyph: 'M6 5h3v9.5a4 4 0 0 1-4 4H4v-2.8h1c.6 0 1-.5 1-1.2V5Zm5 0h3l1.5 7L17 5h3l-3 13h-3l-1.5-6.5L11.9 18H9.5L11 5Z' },
  { id: 'pinterest', name: 'Pinterest', color: '#e60023', hosts: /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, glyph: 'M12 2.5a9.5 9.5 0 0 0-3.5 18.3c-.1-.8-.2-2 0-2.9l1.3-5.4s-.3-.7-.3-1.6c0-1.5.9-2.7 2-2.7.9 0 1.4.7 1.4 1.6 0 1-.6 2.4-.9 3.7-.3 1.1.6 2 1.7 2 2 0 3.5-2.1 3.5-5.2 0-2.7-2-4.6-4.8-4.6-3.3 0-5.2 2.5-5.2 5 0 1 .4 2.1.9 2.7l.1.4-.3 1.3c0 .2-.2.3-.4.2-1.4-.7-2.3-2.7-2.3-4.4 0-3.6 2.6-6.9 7.5-6.9 3.9 0 7 2.8 7 6.6 0 3.9-2.5 7.1-5.9 7.1-1.2 0-2.2-.6-2.6-1.3l-.7 2.7c-.3 1-.9 2.2-1.4 2.9A9.5 9.5 0 1 0 12 2.5Z' },
  { id: 'bluesky', name: 'Bluesky', color: '#1185fe', hosts: /(^|\.)bsky\.app$/, glyph: 'M6.3 4.4c2.3 1.7 4.7 5.2 5.7 7 1-1.8 3.4-5.3 5.7-7 1.6-1.2 4.3-2.2 4.3.9 0 .6-.4 5.2-.6 5.9-.7 2.6-3.3 3.2-5.6 2.8 4 .7 5 2.9 2.8 5.2-4.2 4.3-6-1.1-6.5-2.5l-.1-.4-.1.4c-.5 1.4-2.3 6.8-6.5 2.5-2.2-2.3-1.2-4.5 2.8-5.2-2.3.4-4.9-.2-5.6-2.8C2.4 10.5 2 5.9 2 5.3c0-3.1 2.7-2.1 4.3-.9Z' },
  { id: 'gdrive', name: 'Google Drive', color: '#34a853', hosts: /^drive\.google\.com$/, glyph: 'M8.2 3h7.6l6.2 10.8-3.8 6.6H5.8L2 13.8 8.2 3Zm1.2 2L5 12.6h4.4L13.8 5H9.4Zm6.4 1.2-2.2 3.8 4 6.8 2.2-3.8-4-6.8ZM4.4 14.6l2.2 3.8h8.8l2.2-3.8H4.4Z' },
  { id: 'spreaker', name: 'Spreaker', color: '#f5c300', hosts: /(^|\.)spreaker\.com$/, audioOnly: true, glyph: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM6.3 6.3l1.4 1.4a6 6 0 0 0 0 8.6l-1.4 1.4a8 8 0 0 1 0-11.4Zm11.4 0a8 8 0 0 1 0 11.4l-1.4-1.4a6 6 0 0 0 0-8.6l1.4-1.4Z' },
  { id: 'iheart', name: 'iHeartRadio', color: '#c6002b', hosts: /(^|\.)iheart\.com$/, audioOnly: true, glyph: 'M12 21s-7.5-4.6-9.4-9.4C1.2 8 3.4 4 7.3 4c2 0 3.6 1.1 4.7 2.6C13.1 5.1 14.7 4 16.7 4c3.9 0 6.1 4 4.7 7.6C19.5 16.4 12 21 12 21Z' },
  { id: 'audioboom', name: 'Audioboom', color: '#1ea2e0', hosts: /(^|\.)audioboom\.com$/, audioOnly: true, glyph: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm-4 6v6h2V9H8Zm3-2v10h2V7h-2Zm3 3v4h2v-4h-2Z' },
  { id: 'cnn', name: 'CNN', color: '#cc0000', hosts: /(^|\.)cnn\.com$/, glyph: 'M2 7h20v10H2V7Zm3.5 2.2a2.8 2.8 0 1 0 0 5.6h1.4v-1.6H5.6a1.2 1.2 0 1 1 0-2.4h1.3V9.2H5.5Zm3 0v5.6h1.6v-3.3l2.4 3.3H14V9.2h-1.6v3.3L10 9.2H8.5Zm6.2 0v5.6h1.6v-3.3l2.4 3.3h1.5V9.2h-1.6v3.3l-2.4-3.3h-1.5Z' },
];

const BY_ID = new Map(SITES.map((s) => [s.id, s]));

export function siteById(id: string | null | undefined): Site | null {
  return id ? BY_ID.get(id as SiteId) ?? null : null;
}

export function hostOfUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

export function siteOf(url: string | null | undefined): Site | null {
  const host = hostOfUrl(url);
  if (!host) return null;
  return SITES.find((s) => s.hosts.test(host)) ?? null;
}
