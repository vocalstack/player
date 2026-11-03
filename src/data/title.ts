import { useEffect, useState } from 'react';

const cache = new Map<string, string | null>();

export function useYtTitle(ytId: string | null): string | null {
  const [title, setTitle] = useState<string | null>(() => (ytId ? cache.get(ytId) ?? null : null));
  useEffect(() => {
    if (!ytId) { setTitle(null); return; }
    if (cache.has(ytId)) { setTitle(cache.get(ytId) ?? null); return; }
    let live = true;
    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { title?: unknown } | null) => {
        const t = j && typeof j.title === 'string' && j.title.trim() ? j.title.trim() : null;
        cache.set(ytId, t);
        if (live) setTitle(t);
      })
      .catch(() => { cache.set(ytId, null); });
    return () => { live = false; };
  }, [ytId]);
  return title;
}

const HASH = /^(?:[0-9a-f]{16,}|(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?::\d+)?\/\S*)$/i;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function displayName(parts: { name?: string | null; sourceName?: string | null; ytTitle?: string | null; url?: string | null; id: string }): string {
  const clean = (s?: string | null) => { const t = s?.trim(); return t && t !== parts.id && !ID.test(t) && !HASH.test(t) ? t : null; };
  const host = (() => { if (!parts.url) return null; try { return new URL(parts.url).hostname.replace(/^www\./, ''); } catch { return null; } })();
  return clean(parts.name) ?? clean(parts.sourceName) ?? clean(parts.ytTitle) ?? host ?? (ID.test(parts.id) ? 'VocalStack' : parts.id);
}
