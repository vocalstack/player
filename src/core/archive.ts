export interface ArchiveFile { name?: string; format?: string; source?: string; height?: string | number; size?: string | number; length?: string | number }

const RANK = [/^h\.264( IA)?$/i, /^MPEG4$/i, /^512Kb MPEG4$/i, /^h\.264 HD$/i, /^HiRes MPEG4$/i];

export function archiveVideoFile(id: string, meta: { files?: ArchiveFile[]; metadata?: { mediatype?: string } } | null | undefined, want?: string | null): string | null {
  if (!meta?.files?.length || !/^[\w.-]+$/.test(id)) return null;
  const files = meta.files.filter((f) => typeof f.name === 'string' && /\.mp4$/i.test(f.name) && !f.name.includes('/'));
  const h = (f: ArchiveFile) => Number(f.height) || 0;
  const score = (f: ArchiveFile) => {
    const r = RANK.findIndex((x) => x.test(f.format ?? ''));
    const tall = h(f);
    return (r < 0 ? RANK.length : r) * 10 + (tall > 720 ? 5 : tall && tall < 300 ? 2 : 0);
  };
  const stem = want ? want.replace(/\.[a-z0-9]+$/i, '') : null;
  const pool = stem ? files.filter((f) => f.name!.startsWith(`${stem}.`) || f.name!.startsWith(`${stem}_`)) : [];
  const pick = (pool.length ? pool : files).slice().sort((a, b) => score(a) - score(b))[0];
  return pick ? `https://archive.org/download/${id}/${encodeURIComponent(pick.name!)}` : null;
}

export function archiveTarget(raw: string | null | undefined): { id: string; file: string | null } | null {
  let x: URL;
  try { x = new URL(raw ?? ''); } catch { return null; }
  if (!/(^|\.)archive\.org$/i.test(x.hostname)) return null;
  const m = /^\/(?:details|embed|download)\/([\w.-]+)(?:\/([^?#]+))?/.exec(x.pathname);
  return m ? { id: m[1], file: m[2] ? decodeURIComponent(m[2]) : null } : null;
}

export function archiveSetup(id: string, file: string | null): (v: HTMLVideoElement, fail: () => void) => () => void {
  return (v, fail) => {
    let live = true;
    const ac = new AbortController();
    fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!live) return;
        const src = archiveVideoFile(id, m, file);
        if (!src) { fail(); return; }
        v.src = src;
        v.load();
      })
      .catch(() => { if (live) fail(); });
    return () => { live = false; ac.abort(); v.removeAttribute('src'); v.load(); };
  };
}
