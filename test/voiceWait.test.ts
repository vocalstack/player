import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceWait } from '../src/core/voiceWait.ts';

const base = { on: true, want: false, relang: false, playing: false, preparing: false, starting: null };

test('play pressed before any voice clip exists waits at once', () => {
  assert.equal(voiceWait({ ...base, want: true }), 'asked');
});

test('a new language whose voice is still being listed waits at once', () => {
  assert.equal(voiceWait({ ...base, relang: true }), 'asked');
});

test('playing while the line clip is loading or the voice is starting is a line wait', () => {
  assert.equal(voiceWait({ ...base, playing: true, preparing: true }), 'line');
  assert.equal(voiceWait({ ...base, playing: true, starting: 1 }), 'line');
});

test('nothing waits when paused, voices are off, or the clip is playing', () => {
  assert.equal(voiceWait({ ...base, preparing: true }), null);
  assert.equal(voiceWait({ ...base, playing: true }), null);
  assert.equal(voiceWait({ ...base, on: false, want: true, relang: true, playing: true, preparing: true }), null);
});
