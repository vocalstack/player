export type SiteId = 'youtube' | 'loom' | 'vimeo' | 'twitch' | 'facebook' | 'instagram' | 'dailymotion' | 'tiktok' | 'x' | 'soundcloud' | 'kick' | 'mixcloud' | 'bandcamp';

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
  { id: 'bandcamp', name: 'Bandcamp', color: '#1da0c3', hosts: /(^|\.)bandcamp\.com$/, audioOnly: true, glyph: 'M2 18 8.5 6H22l-6.5 12H2Z' },
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
