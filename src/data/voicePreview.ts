import { useCallback, useEffect, useRef, useState } from 'react';
import { deliveryFormat } from '../core/audio';
import { describe, type ErrorLike } from './errors';
import { usePlayerApi } from './context';

export interface PreviewableVoice { id: string; previewUrl?: string }
const SAMPLE_RETRY_MS = 1500;
const SAMPLE_GIVE_UP_MS = 300_000;

export function useVoicePreview(lang: string | null) {
  const api = usePlayerApi();
  const [armId, setArmId] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [dlId, setDlId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorLike | null>(null);
  const el = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(0);

  const release = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (el.current) { el.current.pause(); el.current.removeAttribute('src'); el.current.load(); el.current = null; }
    if (url.current) { URL.revokeObjectURL(url.current); url.current = null; }
  }, []);

  const stop = useCallback(() => {
    run.current += 1;
    release();
    setSampleId(null);
    setDlId(null);
  }, [release]);

  const reset = useCallback(() => { stop(); setArmId(null); }, [stop]);

  useEffect(() => () => { run.current += 1; release(); }, [release]);

  const arm = useCallback((v: PreviewableVoice) => {
    run.current += 1;
    const mine = run.current;
    release();
    setArmId(v.id);
    setSampleId(null);
    setDlId(null);
    setError(null);
    if (!lang) return;
    let src = v.previewUrl
      ? `${api.origin}${v.previewUrl}`
      : `${api.origin}/v1/voices/preview?voice=${encodeURIComponent(v.id)}&lang=${encodeURIComponent(lang)}`;
    if (deliveryFormat() === 'caf') src += `${src.includes('?') ? '&' : '?'}format=caf`;
    const started = Date.now();
    if (api.shareCode && src.includes('recording=')) src += `&shareCode=${encodeURIComponent(api.shareCode)}`;
    const ask = async () => {
      if (run.current !== mine) return;
      let res: Response;
      try {
        const token = api.owner ? await api.bearer() : undefined;
        res = await fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      } catch (e) {
        if (run.current !== mine) return;
        setDlId(null);
        setError(describe(e));
        return;
      }
      if (run.current !== mine) return;
      if (res.status === 202 || res.status === 503) {
        if (Date.now() - started > SAMPLE_GIVE_UP_MS) {
          setDlId(null);
          setError({ message: 'This voice is still being fetched. Try it again in a moment.' });
          return;
        }
        setDlId(v.id);
        timer.current = setTimeout(() => { void ask(); }, SAMPLE_RETRY_MS);
        return;
      }
      if (!res.ok) {
        setDlId(null);
        const body = await res.json().catch(() => null) as { code?: string } | null;
        setError(body?.code === 'language_unavailable'
          ? { message: 'No voice can speak this language yet.', status: res.status }
          : { message: `This voice could not be previewed (${res.status}).`, status: res.status });
        return;
      }
      const blob = await res.blob();
      if (run.current !== mine) return;
      setDlId(null);
      url.current = URL.createObjectURL(blob);
      const a = new Audio(url.current);
      (a as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      const done = () => { if (run.current === mine) { release(); setSampleId(null); } };
      a.onended = done;
      a.onerror = done;
      el.current = a;
      void a.play().then(() => { if (run.current === mine) setSampleId(v.id); }).catch(done);
    };
    void ask();
  }, [lang, release, api]);

  return { armId, sampleId, dlId, error, clearError: () => setError(null), arm, stop, reset };
}
