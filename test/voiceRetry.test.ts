import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startingRetryMs, STARTING_DEFAULT_MS } from '../src/core/voiceRetry.ts';

test('a 503 with Retry-After waits that long, within 1-15 s', () => {
  assert.equal(startingRetryMs(503, '1', null), 1000);
  assert.equal(startingRetryMs(503, '5', null), 5000);
  assert.equal(startingRetryMs(503, '600', null), 15000);
  assert.equal(startingRetryMs(503, '0', null), 1000);
});

test('a 503 whose Retry-After the page cannot read is still a voice starting when its body says so', () => {
  assert.equal(startingRetryMs(503, null, { code: 'engine_unavailable', retryable: true }), STARTING_DEFAULT_MS);
  assert.equal(startingRetryMs(503, null, { retryable: true }), STARTING_DEFAULT_MS);
  assert.equal(startingRetryMs(503, '', { code: 'engine_unavailable' }), STARTING_DEFAULT_MS);
});

test('anything else is not a voice starting', () => {
  assert.equal(startingRetryMs(503, null, null), null);
  assert.equal(startingRetryMs(503, null, { code: 'internal' }), null);
  assert.equal(startingRetryMs(429, '3', { retryable: true }), null);
  assert.equal(startingRetryMs(404, null, null), null);
});
