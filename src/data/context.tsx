import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { VocalStack, type Recording, type TranscriptionJob, type ReadAs } from '@vocalstack/js-sdk';
import type { MediaCred } from '../core/audio';
import { describe, type ErrorLike } from './errors';

export const DEFAULT_API = 'https://api.vocalstack.com';

export interface PlayerApi {
  client: VocalStack;
  origin: string;
  owner: boolean;
  shareCode: string | null;
  bearer: () => Promise<string | undefined>;
  cred: MediaCred;
  readAs: ReadAs;
}

export interface PlayerSource {
  key: string;
  code: string | null;
  transcriptionId: string | null;
  name: string;
  recording: Recording;
  job: TranscriptionJob | null;
  allowDownload: boolean;
  allowExport: boolean;
  allowTranslate: boolean;
  sharedBy: string | null;
}

const Ctx = createContext<PlayerApi | null>(null);

export function usePlayerApi(): PlayerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('VocalStack player hooks must be used inside <VocalStackPlayer>');
  return v;
}

export function PlayerApiProvider({ value, children }: { value: PlayerApi; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTranscriptionId(id: string): boolean {
  return UUID.test(id);
}

export type TokenSource = string | (() => string | undefined | null | Promise<string | undefined | null>);

export interface ApiOptions { id: string; token?: TokenSource | null; baseUrl?: string | null }

export function useApi(o: ApiOptions): PlayerApi {
  const owner = isTranscriptionId(o.id) && !!o.token;
  const origin = (o.baseUrl ?? DEFAULT_API).replace(/\/$/, '');
  const tokRef = useRef(o.token);
  tokRef.current = o.token;
  const hasToken = !!o.token;
  const bearer = useMemo(() => async () => {
    const t = tokRef.current;
    const v = typeof t === 'function' ? await t() : t;
    return v || undefined;
  }, []);
  const client = useMemo(() => new VocalStack({ baseUrl: origin, token: hasToken ? bearer : undefined }), [origin, hasToken, bearer]);
  return useMemo(() => {
    const shareCode = owner ? null : o.id;
    const readAs: ReadAs = shareCode ? { shareCode } : {};
    return { client, origin, owner, shareCode, bearer, cred: { shareCode }, readAs };
  }, [client, origin, owner, o.id, bearer]);
}

export function withMedia(api: PlayerApi, media: string | null): PlayerApi {
  return media ? { ...api, cred: { media } } : api;
}

export async function loadSource(api: PlayerApi, id: string): Promise<PlayerSource> {
  if (api.owner) {
    const tx = await api.client.transcriptions.get(id);
    const job = (tx as any).job ?? null;
    const rid: string | null = job?.recordingId ?? null;
    if (!rid) throw Object.assign(new Error('This transcription has no recording yet.'), { code: 'not_found', status: 404 });
    const recording = await api.client.recordings.get(rid);
    return { key: id, code: null, transcriptionId: tx.id, name: tx.name ?? '', recording, job, allowDownload: true, allowExport: true, allowTranslate: true, sharedBy: null };
  }
  const s = await api.client.shareLinks.open(id);
  return {
    key: id, code: s.code ?? id, transcriptionId: s.transcriptionId ?? null, name: s.name ?? '', recording: s.recording, job: s.job ?? null,
    allowDownload: !!s.allowDownload, allowExport: !!s.allowExport, allowTranslate: !!s.allowTranslate, sharedBy: s.sharedBy ?? null,
  };
}

export function useSource(api: PlayerApi, id: string): { source: PlayerSource | null; gone: boolean; error: ErrorLike | null; reload: () => void } {
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<ErrorLike | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    loadSource(api, id)
      .then((s) => { if (alive) { setSource(s); setGone(false); setError(null); } })
      .catch((e) => { if (!alive) return; const d = describe(e); if (d.code === 'not_found' || d.status === 404) setGone(true); else setError(d); });
    return () => { alive = false; };
  }, [api, id, n]);
  return { source, gone, error, reload: () => setN((x) => x + 1) };
}

export function useMediaToken(api: PlayerApi, recordingId: string | null): string | null {
  const [tok, setTok] = useState<string | null>(null);
  useEffect(() => {
    if (!api.owner || !recordingId) { setTok(null); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const get = () => api.client.recordings.mediaToken(recordingId).then((t) => {
      if (!alive) return;
      setTok(t.token);
      const left = Date.parse(t.expiresAt) - Date.now();
      timer = setTimeout(get, Math.max(60_000, left - 10 * 60_000));
    }).catch(() => { if (alive) timer = setTimeout(get, 30_000); });
    void get();
    return () => { alive = false; clearTimeout(timer); };
  }, [api, recordingId]);
  return tok;
}

export async function apiFetch(api: PlayerApi, path: string, init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {}): Promise<Response> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(init.query ?? {})) if (v != null) q.set(k, v);
  if (api.shareCode) q.set('shareCode', api.shareCode);
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (api.owner) { const t = await api.bearer(); if (t) headers.authorization = `Bearer ${t}`; }
  const qs = q.toString();
  return fetch(`${api.origin}${path}${qs ? `${path.includes('?') ? '&' : '?'}${qs}` : ''}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}
