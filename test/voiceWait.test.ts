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

test('a translation or voice list on its way is a card that holds the recording clock; only a video plays on under a quiet note', async () => {
  const { holdsClock, softWaitOf } = await import('../src/core/voiceWait.ts');
  const audio = { timeline: true, videoLed: false, voiceOn: true, starting: null, relang: false };
  assert.equal(softWaitOf({ videoLed: false, wait: 'translating', relang: false }), false, 'with no video the translation shows its card');
  assert.equal(softWaitOf({ videoLed: true, wait: 'translating', relang: false }), true, 'a video plays on under a note');
  assert.equal(holdsClock({ ...audio, wait: 'translating' }), true);
  assert.equal(holdsClock({ ...audio, wait: 'voice', relang: true }), true);
  assert.equal(holdsClock({ ...audio, wait: null, starting: 5 }), true, 'a voice starting from cold holds the clock');
  assert.equal(holdsClock({ ...audio, wait: null }), false);
  assert.equal(holdsClock({ ...audio, wait: 'translateFailed' }), false, 'a failed translation does not hold: its alert offers the way on');
  assert.equal(holdsClock({ ...audio, videoLed: true, wait: 'translating' }), false, 'a video is never held');
  assert.equal(holdsClock({ ...audio, timeline: false, starting: 5, wait: null }), false, 'clips read back to back hold themselves');
});

test('on the recording clock a line whose voice is still being made holds the clock until its clip is there', async () => {
  const { holdsClock } = await import('../src/core/voiceWait.ts');
  const dash = { timeline: true, videoLed: false, voiceOn: true, starting: null, wait: null, relang: false };
  assert.equal(holdsClock({ ...dash, coming: true }), true, 'the clock waits for the clip on its way, as clips read back to back did');
  assert.equal(holdsClock({ ...dash, coming: false }), false, 'a line with no clip coming plays on in silence');
});
