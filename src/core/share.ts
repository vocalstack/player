export function shareCodeOf(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    const m = /^\/(?:t|v)\/([a-z0-9]{6,24})(?:\/.*)?$/i.exec(u.pathname);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function playIdOf(id: string | null | undefined, withToken: boolean): string {
  const v = id?.trim() ?? '';
  return v && !withToken ? shareCodeOf(v) ?? v : v;
}
