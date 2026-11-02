export const ytIdOf = (u: string | null | undefined) => u?.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)?.[1] ?? null;

export const YOUTUBE_LINK = /(youtube\.com|youtu\.be)/i;

export const isLiveRefusal = (url: string | null | undefined, error: string | null | undefined) =>
  !!ytIdOf(url) && /live stream/i.test(error ?? '');

export const previewEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?modestbranding=1&rel=0&playsinline=1`;

export const ytThumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

export const YT_D = 'M2.25 12c0-2.6.2-4.3.5-5.2a2.3 2.3 0 0 1 1.6-1.6C5.8 4.8 12 4.8 12 4.8s6.2 0 7.65.4a2.3 2.3 0 0 1 1.6 1.6c.3.9.5 2.6.5 5.2s-.2 4.3-.5 5.2a2.3 2.3 0 0 1-1.6 1.6c-1.45.4-7.65.4-7.65.4s-6.2 0-7.65-.4a2.3 2.3 0 0 1-1.6-1.6c-.3-.9-.5-2.6-.5-5.2ZM10 9.25v5.5L14.75 12 10 9.25Z';

export async function youtubeTitle(id: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const watch = `https://www.youtube.com/watch?v=${id}`;
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: unknown };
    return typeof j.title === 'string' && j.title.trim() ? j.title.trim() : null;
  } catch {
    return null;
  }
}

export async function youtubeChannel(id: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const watch = `https://www.youtube.com/watch?v=${id}`;
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { author_name?: unknown; title?: unknown };
    const name = typeof j.author_name === 'string' && j.author_name.trim() ? j.author_name : typeof j.title === 'string' ? j.title : '';
    return name.trim() || null;
  } catch {
    return null;
  }
}

export const liveEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;
