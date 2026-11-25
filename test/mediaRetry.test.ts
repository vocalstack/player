import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterMediaError, probeAudio, recentRetries, MEDIA_RETRY_WINDOW_MS } from '../src/core/audio.ts';

const ok = { reachable: true, why: null };
const busy = { reachable: false, why: { message: 'Engine busy.', permanent: false } };
const gone = { reachable: false, why: { message: 'The audio for this recording was not captured.', permanent: true } };
const unknown = { reachable: false, why: null };

test('a media error while the API still redirects to the file reloads at once (a fresh, freshly signed address)', () => {
  assert.equal(afterMediaError({ code: 2, probe: ok, recent: 0, max: 4 }), 'reload');
  assert.equal(afterMediaError({ code: 2, probe: ok, recent: 3, max: 4 }), 'reload');
});

test('a decode or format error is not a stale address: it fails at once, as before', () => {
  assert.equal(afterMediaError({ code: 3, probe: ok, recent: 0, max: 4 }), 'fail');
  assert.equal(afterMediaError({ code: 4, probe: ok, recent: 0, max: 4 }), 'fail');
});

test('a passing refusal waits and retries; a lasting one, an unexplained one or too many tries fails', () => {
  assert.equal(afterMediaError({ code: 2, probe: busy, recent: 0, max: 4 }), 'later');
  assert.equal(afterMediaError({ code: 2, probe: gone, recent: 0, max: 4 }), 'fail');
  assert.equal(afterMediaError({ code: 2, probe: unknown, recent: 0, max: 4 }), 'fail');
  assert.equal(afterMediaError({ code: 2, probe: ok, recent: 4, max: 4 }), 'fail');
  assert.equal(afterMediaError({ code: 2, probe: busy, recent: 4, max: 4 }), 'fail');
});

test('only retries in the last ten minutes count, so a page left open for hours can recover again', () => {
  const now = 10_000_000;
  assert.equal(recentRetries([], now), 0);
  assert.equal(recentRetries([now - 1000, now - 2000], now), 2);
  assert.equal(recentRetries([now - MEDIA_RETRY_WINDOW_MS - 1, now - 5000], now), 1);
});

test('the probe tells a redirect (reachable) from a refusal with a reason and from a network failure', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (async () => ({ type: 'opaqueredirect', ok: false, status: 0, json: async () => null })) as never;
    assert.deepEqual(await probeAudio('https://x/a'), ok);
    globalThis.fetch = (async () => ({ type: 'cors', ok: false, status: 401, json: async () => ({ error: 'invalid_token', message: 'the access token has expired' }) })) as never;
    assert.deepEqual(await probeAudio('https://x/a'), { reachable: false, why: { message: 'The access token has expired.', permanent: false } });
    globalThis.fetch = (async () => ({ type: 'cors', ok: false, status: 404, json: async () => ({ message: 'no such artifact yet.' }) })) as never;
    assert.deepEqual(await probeAudio('https://x/a'), { reachable: false, why: { message: 'No such artifact yet.', permanent: true } });
    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as never;
    assert.deepEqual(await probeAudio('https://x/a'), unknown);
  } finally {
    globalThis.fetch = real;
  }
});
