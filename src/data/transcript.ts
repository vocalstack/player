import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageLists, Subscription } from '@vocalstack/js-sdk';
import { applyFrame, empty, fromSnapshot, hasLanguage, type Model } from '../core/transcript';
import { describe, type ErrorLike } from './errors';
import { usePlayerApi, type PlayerApi } from './context';

export { describe, type ErrorLike };

const langCache = new Map<string, LanguageLists>();
export function useLanguages(): LanguageLists | null {
  const api = usePlayerApi();
  const [l, setL] = useState<LanguageLists | null>(langCache.get(api.origin) ?? null);
  useEffect(() => {
    if (langCache.has(api.origin)) return;
    api.client.languages.list().then((x) => { langCache.set(api.origin, x); setL(x); }).catch(() => {});
  }, [api]);
  return l;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: ErrorLike | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ErrorLike | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then((d) => alive && setData(d)).catch((e) => alive && setError(describe(e)));
    return () => { alive = false; };
  }, [...deps, n]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, reload: () => setN((x) => x + 1) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PENDING_REFETCH_MS = 2500;
const PENDING_REFETCHES = 72;

export function useTranscript(recordingId: string | null, opts: { lang?: string | null; voice?: string | null; onState?: (s: string, reason?: string) => void; onFrame?: (f: any) => void }) {
  const api: PlayerApi = usePlayerApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [model, setModel] = useState<Model>(empty);
  const modelRef = useRef<Model>(empty());
  const subRef = useRef<Subscription | null>(null);
  const langRef = useRef<string | null>(opts.lang ?? null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<ErrorLike | null>(null);
  const [notFound, setNotFound] = useState(false);
  const bump = useCallback(() => {
    const m = modelRef.current;
    setModel({ ...m });
  }, []);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!recordingId) return;
    let alive = true;
    let attempt = 0;
    modelRef.current = empty();
    setModel(empty());
    setNotFound(false);
    const client = api.client;
    let announced = modelRef.current.state;
    const announceState = () => {
      const s = modelRef.current.state;
      if (s === announced) return;
      announced = s;
      optsRef.current.onState?.(s);
    };
    (async () => {
      while (alive) {
        let sub: Subscription | null = null;
        try {
          const asked = langRef.current;
          sub = await client.recordings.subscribe(recordingId, { lang: asked ?? undefined, ...api.readAs, asOwner: api.owner, voice: opts.voice ?? undefined });
          if (!alive) { sub.close(); return; }
          attempt = 0;
          subRef.current = sub;
          if (langRef.current !== asked) sub.setLanguage(langRef.current);
          setConnected(true);
          setError(null);
          modelRef.current = fromSnapshot(sub.snapshot!, modelRef.current);
          bump();
          announceState();
          for await (const ev of sub) {
            if (!alive) break;
            if (ev.type === 'snapshot') { modelRef.current = fromSnapshot(ev.snapshot, ev.reason === 'gap' ? modelRef.current : empty()); bump(); announceState(); }
            else if (ev.type === 'frame') {
              applyFrame(modelRef.current, ev.frame);
              const f: any = ev.frame;
              if (f.type === 'recording.state') { announced = modelRef.current.state; optsRef.current.onState?.(f.state, f.reason); }
              optsRef.current.onFrame?.(f);
              bump();
            } else if (ev.type === 'closed') {
              setConnected(false);
            }
          }
        } catch (e) {
          if (!alive) return;
          const d = describe(e);
          if (d.code === 'not_found' || d.status === 404) { setNotFound(true); setError(d); return; }
          try {
            await client.recordings.get(recordingId, api.readAs);
          } catch (pe) {
            const pd = describe(pe);
            if (pd.code === 'not_found' || pd.status === 404) { setNotFound(true); setError(pd); return; }
            if (pd.code === 'forbidden' || pd.code === 'invalid_token' || pd.code === 'password_required' || pd.status === 401 || pd.status === 403) { setError(pd); return; }
          }
          if (d.code === 'forbidden' || d.code === 'invalid_token' || d.code === 'password_required' || d.status === 401 || d.status === 403) { setError(d); return; }
          setError(d);
        } finally {
          if (subRef.current === sub) subRef.current = null;
          setConnected(false);
        }
        const st = modelRef.current.state;
        if (!alive || st === 'ended' || st === 'finalized' || st === 'processing') return;
        attempt += 1;
        await sleep(Math.min(15000, 1000 * 2 ** Math.min(attempt, 4)));
      }
    })();
    return () => {
      alive = false;
      subRef.current?.close();
      subRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId, api, opts.voice]);

  const [translating, setTranslating] = useState(false);
  const [translateFailed, setTranslateFailed] = useState<string | null>(null);
  const langTurn = useRef(0);
  const [shownLang, setShownLang] = useState<string | null>(null);
  const setLanguage = useCallback((lang: string | null) => {
    langRef.current = lang;
    subRef.current?.setLanguage(lang);
    if (!recordingId) return;
    const turn = ++langTurn.current;
    if (lang == null || hasLanguage(modelRef.current, lang)) {
      setTranslateFailed(null);
      setTranslating(false);
      setShownLang(lang);
      return;
    }
    const client = apiRef.current.client;
    setTranslating(true);
    setTranslateFailed(null);
    const fetchOnce = (again: number) => client.recordings.transcript(recordingId, { lang: lang ?? undefined, ...apiRef.current.readAs, asListener: !apiRef.current.owner })
      .then((snap) => {
        if (turn !== langTurn.current) return;
        modelRef.current = fromSnapshot(snap, modelRef.current);
        setShownLang(lang);
        bump();
        if (snap.translationPending && again > 0) window.setTimeout(() => { if (turn === langTurn.current) void fetchOnce(again - 1).catch(() => {}); }, PENDING_REFETCH_MS);
      });
    fetchOnce(PENDING_REFETCHES)
      .catch(() => { if (turn === langTurn.current && lang) setTranslateFailed(lang); })
      .finally(() => { if (turn === langTurn.current) setTranslating(false); });
  }, [bump, recordingId]);

  const mergeTranslations = useCallback((lang: string, made: Record<string, string>) => {
    const m = modelRef.current;
    let touched = false;
    for (const [id, text] of Object.entries(made)) {
      const s = m.sentences.get(Number(id));
      if (!s) continue;
      s.translations = { ...s.translations, [lang]: text };
      touched = true;
    }
    if (touched) bump();
  }, [bump]);
  const clearError = useCallback(() => setError(null), []);


  return { model, connected, error, notFound, clearError, setLanguage, mergeTranslations, translating, translateFailed, shownLang };
}
