import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaKindOf } from '../src/core/audio.ts';

test('a media error names what failed to play, never its credentials', () => {
  assert.equal(mediaKindOf('https://api.vocalstack.com/v1/transcriptions/r1/audio?kind=delivery&format=ogg&access_token=secret'), 'delivery ogg');
  assert.equal(mediaKindOf('https://api.vocalstack.com/v1/transcriptions/r1/audio?kind=voice&lang=ro&format=caf&shareCode=abc'), 'voice caf ro');
  assert.equal(mediaKindOf('https://api.vocalstack.com/v1/transcriptions/r1/voice/12?lang=en&voice=x'), '12 en');
  assert.equal(mediaKindOf('/v1/transcriptions/r1/audio?kind=source&access_token=secret'), 'source', 'a relative link too');
});

test('Opus in CAF goes only to WebKit, which mis-plays Ogg; every other browser gets Ogg even when it claims CAF', async () => {
  const { pickDeliveryFormat } = await import('../src/core/audio.ts');
  assert.equal(pickDeliveryFormat({ vendor: 'Apple Computer, Inc.', caf: 'probably' }), 'caf', 'Safari, and every iOS browser');
  assert.equal(pickDeliveryFormat({ vendor: 'Google Inc.', caf: 'probably' }), 'ogg', 'Chrome said probably and could not decode it (Sentry WEB-F)');
  assert.equal(pickDeliveryFormat({ vendor: '', caf: '' }), 'ogg', 'Firefox');
  assert.equal(pickDeliveryFormat({ vendor: 'Apple Computer, Inc.', caf: '' }), 'ogg', 'an old WebKit without Opus in CAF');
});

test('a silenced clock goes quiet by volume, not mute, so a hidden Chrome tab keeps it playing; where volume is fixed (iOS) it is muted', async () => {
  const { applySound } = await import('../src/core/audio.ts');
  const el = { muted: false, volume: 1 };
  applySound(el, { muted: false, silenced: true, volume: 0.8 });
  assert.deepEqual(el, { muted: false, volume: 0 }, 'Chrome pauses a muted element in a background tab, so silence is volume 0');
  applySound(el, { muted: false, silenced: false, volume: 0.8 });
  assert.deepEqual(el, { muted: false, volume: 0.8 }, 'the volume comes back when the silence ends');
  applySound(el, { muted: true, silenced: true, volume: 0.8 });
  assert.deepEqual(el, { muted: true, volume: 0 }, 'a listener mute stays a mute');
  let v = 1;
  const ios = { muted: false, get volume() { return v; }, set volume(_x: number) { v = 1; } };
  applySound(ios, { muted: false, silenced: true, volume: 1 });
  assert.equal(ios.muted, true, 'a browser that ignores volume is muted instead');
  applySound(ios, { muted: false, silenced: false, volume: 1 });
  assert.equal(ios.muted, false);
});
