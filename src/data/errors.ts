import { VocalStackError } from '@vocalstack/js-sdk';
import { reportError } from '../core/audio';

export interface ErrorLike { message: string; code?: string; status?: number; details?: any }

const THEIRS = new Set([
  'invalid_audio', 'invalid_options', 'invalid_token', 'invalid_body', 'session_expired', 'forbidden',
  'not_found', 'conflict', 'invalid_state', 'password_required', 'rate_limited', 'language_unavailable', 'suspended',
  'key_expired', 'key_revoked', 'key_from_browser', 'insufficient_credit', 'usage_cap_reached', 'payment_method_required',
  'range_too_long', 'quota_exceeded', 'invalid_request', 'aborted', 'unauthorized',
]);

const OURS: Record<string, string> = {
  internal: 'Something went wrong on our side. Please try again.',
  unavailable: 'VocalStack is briefly unavailable. Please try again in a moment.',
  engine_unavailable: 'No transcription engine is available right now. Please try again in a moment.',
  engine_lost: 'The transcription engine stopped. Please try again.',
  capacity_exceeded: 'Every transcription engine is busy right now. Please try again in a moment.',
  timeout: 'That took too long. Please try again.',
};
export const GENERIC = OURS.internal;
export const OFFLINE = "Can't reach VocalStack. Check your connection.";

const BROWSER: Record<string, string> = {
  NotAllowedError: 'The browser blocked this. Allow it for this site, then try again.',
  NotSupportedError: 'This browser cannot play this.',
  AbortError: 'It was cancelled.',
};

export function describe(e: unknown): ErrorLike {
  const any = e as any;
  const code: string | undefined = typeof any?.code === 'string' ? any.code : undefined;
  const status: number | undefined = typeof any?.status === 'number' ? any.status : undefined;
  const details = any?.details;
  if (code || (status && status >= 400)) {
    if (code && THEIRS.has(code) && typeof any?.message === 'string') return { message: any.message, code, status, details };
    if (code === 'unavailable' && status === undefined) return { message: OFFLINE, code, details };
    if (status === 0) return { message: typeof any?.message === 'string' ? any.message : OFFLINE, code, status, details };
    return { message: (code && OURS[code]) || GENERIC, code, status, details };
  }
  const name: string = any?.name ?? '';
  if (name === 'TypeError' && /fetch|network|load failed/i.test(String(any?.message ?? ''))) {
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) reportError(e instanceof Error ? e : new Error(String(e)));
    return { message: OFFLINE };
  }
  if (BROWSER[name]) return { message: BROWSER[name] };
  if (e instanceof Error && name === 'Error' && !(e instanceof VocalStackError)) return { message: e.message };
  return { message: GENERIC };
}
