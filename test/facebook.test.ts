import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fbFit, fbNow, fbSample, fbState, fbStep, fbWidth } from '../src/core/facebook.ts';

test('facebook position is read when it changes, and carried forward between its steps', () => {
  const s = fbState();
  assert.equal(fbNow(s, 0), null);
  fbSample(s, 10, 1000);
  assert.equal(s.t, 10);
  assert.equal(s.at, 1000);
  fbSample(s, 10, 1200);
  assert.equal(s.at, 1000);
  fbSample(s, NaN, 1300);
  assert.equal(s.t, 10);
  s.playing = true;
  assert.equal(fbNow(s, 1200), 10.2);
  assert.equal(fbNow(s, 5000), 10.5);
  assert.equal(fbNow({ ...s, buffering: true }, 1200), 10);
  assert.equal(fbNow({ ...s, playing: false }, 1200), 10);
  fbSample(s, 10.265, 1265);
  assert.equal(fbNow(s, 1265), 10.265);
});

test('the facebook picture follows the VocalStack clock within half a second', () => {
  const s = { ...fbState(), t: 20, at: 1000, seen: 20, playing: true, duration: 284 };
  assert.deepEqual(fbStep(s, { t: 20.6, playing: true }, 1200), { kind: 'none' });
  assert.deepEqual(fbStep(s, { t: 20.8, playing: true, lead: 0.3 }, 1200), { kind: 'seek', to: 21.1 });
  assert.deepEqual(fbStep(s, { t: 19.4, playing: true, lead: 0.3 }, 1000), { kind: 'seek', to: 19.7 });
  assert.deepEqual(fbStep(s, { t: 25, playing: true, settling: true }, 1000), { kind: 'none' });
  assert.deepEqual(fbStep({ ...s, buffering: true }, { t: 25, playing: true }, 1000), { kind: 'none' });
  assert.deepEqual(fbStep({ ...s, playing: false }, { t: 20, playing: true }, 1000), { kind: 'play' });
  assert.deepEqual(fbStep(s, { t: 20, playing: false }, 1000), { kind: 'pause' });
  assert.deepEqual(fbStep(s, { t: 284, playing: true }, 1000), { kind: 'pause' });
});

test('the facebook player is made wide and scaled to fit the picture with black bars', () => {
  assert.equal(fbWidth(760, 1920), 1920);
  assert.equal(fbWidth(760, 3840), 1920);
  assert.equal(fbWidth(200, 0), 320);
  assert.equal(fbWidth(1000, 0), 1000);
  assert.deepEqual(fbFit({ w: 760, h: 428 }, { w: 1920, h: 1080 }), { scale: 760 / 1920, w: 760, h: 1080 * 760 / 1920 });
  const wide = fbFit({ w: 2000, h: 1100 }, { w: 1920, h: 1080 });
  assert.equal(wide.scale, 1100 / 1080);
  assert.ok(wide.w < 2000);
  const tall = fbFit({ w: 1600, h: 900 }, { w: 1920, h: 3413 });
  assert.ok(Math.abs(tall.h - 900) < 1e-6 && tall.w < 1600);
  assert.deepEqual(fbFit({ w: 0, h: 0 }, { w: 1920, h: 1080 }), { scale: 1, w: 1920, h: 1080 });
});
