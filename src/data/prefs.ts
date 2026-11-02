import { useEffect, useState } from 'react';
import type { LanguageLists } from '@vocalstack/js-sdk';

const RECENT = 'vs.recentLangs';
const subs = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { }
  for (const s of subs) s();
}

export function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    const on = () => setV(read(key, fallback));
    subs.add(on);
    window.addEventListener('storage', on);
    return () => { subs.delete(on); window.removeEventListener('storage', on); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, (x: T) => { setV(x); write(key, x); }];
}

export function forgetRecentLang(code: string) {
  const list = read<string[]>(RECENT, []);
  write(RECENT, Array.isArray(list) ? list.filter((c) => c !== code) : []);
}

export function useRecentLangs(): [string[], (code: string | null) => void] {
  const [list, set] = useStored<string[]>(RECENT, []);
  const safe = Array.isArray(list) ? list : [];
  return [safe, (code: string | null) => { if (code) set([code, ...safe.filter((c) => c !== code)].slice(0, 3)); }];
}

export function pickerLanguages(langs: LanguageLists | null, kind: 'transcription' | 'translation' | 'voice') {
  if (!langs) return [];
  const allowed = new Set(langs[kind]);
  return langs.languages.filter((l) => allowed.has(l.code)).map((l) => ({ code: l.code, label: l.name, native: l.native, flag: l.flag ?? '🌐', voice: !!l.voice }));
}

export function useSidePins(id: string): [string[], (v: string[]) => void] {
  const [pins, setPins] = useStored<string[] | null>(`vs.pins.${id}`, null);
  return [Array.isArray(pins) ? pins : [], setPins];
}

export const COL_W = 352;
export function useColW(id: string): [number, (v: number | null) => void] {
  const [w, set] = useStored<number | null>(id === 'ga' ? 'vs.colW.ga' : 'vs.colW', null);
  return [typeof w === 'number' && w > 0 ? w : id === 'ga' ? 560 : COL_W, set];
}
