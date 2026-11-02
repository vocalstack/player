import { useEffect, useState } from 'react';
import { VocalStack } from '@vocalstack/js-sdk';
import { DEFAULT_API, type TokenSource } from './context';

export function useLookup(src: string | null, token: TokenSource | null, baseUrl: string | null): { id: string } | null | undefined {
  const [found, setFound] = useState<{ id: string } | null | undefined>(src ? (token ? undefined : null) : null);
  useEffect(() => {
    if (!src) { setFound(null); return; }
    if (!token) { setFound(null); return; }
    let alive = true;
    setFound(undefined);
    const client = new VocalStack({ baseUrl: (baseUrl ?? DEFAULT_API).replace(/\/$/, ''), token: async () => { const v = typeof token === 'function' ? await token() : token; return v || undefined; } });
    const look = (client.transcriptions as unknown as { lookup?: (u: string) => Promise<{ id: string } | null> }).lookup;
    if (!look) { setFound(null); return; }
    look.call(client.transcriptions, src).then((t) => { if (alive) setFound(t ? { id: t.id } : null); }).catch(() => { if (alive) setFound(null); });
    return () => { alive = false; };
  }, [src, token, baseUrl]);
  return found;
}
