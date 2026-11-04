import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIMEO_ORIGIN, vimeoFrame, vimeoLoud, vimeoMsg, vimeoNow, vmStep, type VmState } from '../src/core/vimeo.ts';

test('the vimeo frame is muted, without controls and starts where VocalStack is', () => {
  const f = new URL(vimeoFrame('27910888', { t: 12.7 }));
  assert.equal(f.origin, VIMEO_ORIGIN);
  assert.equal(f.pathname, '/video/27910888');
  for (const [k, v] of Object.entries({ muted: '1', controls: '0', autoplay: '0', autopause: '0', background: '0', dnt: '1' })) assert.equal(f.searchParams.get(k), v, k);
  assert.equal(f.searchParams.get('transparent'), null);
  assert.equal(f.searchParams.get('h'), null);
  assert.equal(f.hash, '#t=12s');
  assert.equal(new URL(vimeoFrame('1', { t: 0, h: 'abcdef12' })).searchParams.get('h'), 'abcdef12');
});

test('only messages from the vimeo player are read', () => {
  assert.deepEqual(vimeoMsg(VIMEO_ORIGIN, '{"event":"ready"}'), { event: 'ready' });
  assert.deepEqual(vimeoMsg(VIMEO_ORIGIN, { event: 'playProgress', data: { seconds: 3 } }), { event: 'playProgress', data: { seconds: 3 } });
  assert.equal(vimeoMsg('https://evil.example', '{"event":"ready"}'), null);
  assert.equal(vimeoMsg(VIMEO_ORIGIN, 'not json'), null);
  assert.equal(vimeoMsg(VIMEO_ORIGIN, 5), null);
});

test('the vimeo picture follows the VocalStack clock', () => {
  const s: VmState = { t: 20, at: 1000, playing: true, buffering: false, duration: 112 };
  assert.equal(vimeoNow(s, 1500), 20.5);
  assert.equal(vimeoNow({ ...s, playing: false }, 1500), 20);
  assert.equal(vimeoNow(s, 9000), 21);
  assert.deepEqual(vmStep(s, { t: 20.3, playing: true }, 1000), { kind: 'none' });
  assert.deepEqual(vmStep(s, { t: 25, playing: true, lead: 0.2 }, 1000), { kind: 'seek', to: 25.2 });
  assert.deepEqual(vmStep(s, { t: 25, playing: true, settling: true }, 1000), { kind: 'none' });
  assert.deepEqual(vmStep({ ...s, buffering: true }, { t: 25, playing: true }, 1000), { kind: 'none' });
  assert.deepEqual(vmStep({ ...s, playing: false }, { t: 20, playing: true }, 1000), { kind: 'play' });
  assert.deepEqual(vmStep({ ...s, ended: true }, { t: 20, playing: true }, 1000), { kind: 'play' });
  assert.deepEqual(vmStep(s, { t: 20, playing: false }, 1000), { kind: 'pause' });
  assert.deepEqual(vmStep({ ...s, playing: false }, { t: 20, playing: false }, 1000), { kind: 'none' });
  assert.deepEqual(vmStep(s, { t: 112, playing: true }, 1000), { kind: 'pause' });
  assert.deepEqual(vmStep({ ...s, t: 100 }, { t: 111, playing: true, lead: 1.5 }, 1000), { kind: 'seek', to: 111.5 });
});

test('a vimeo player that unmutes itself is heard as loud', () => {
  assert.equal(vimeoLoud({ volume: 0, muted: true }), false);
  assert.equal(vimeoLoud({ volume: 0, muted: false }), true);
  assert.equal(vimeoLoud({ volume: 0.5, muted: true }), true);
  assert.equal(vimeoLoud(null), false);
});
