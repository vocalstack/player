import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindMediaKeys, onMediaKey, MEDIA_KEYS, type MediaKey, type MediaKeyTarget } from '../src/core/mediaKeys.ts';
import { followBed, type BedMedia } from '../src/core/background.ts';

function target(playing: boolean) {
  const calls: string[] = [];
  const t: MediaKeyTarget = { playing, toggle: () => { calls.push('toggle'); t.playing = !t.playing; }, next: () => calls.push('next'), prev: () => calls.push('prev') };
  return { t, calls };
}

test('the play/pause keys drive the one player toggle, never twice', () => {
  const a = target(true);
  onMediaKey('pause', a.t);
  onMediaKey('pause', a.t);
  assert.deepEqual(a.calls, ['toggle']);
  assert.equal(a.t.playing, false);
  onMediaKey('play', a.t);
  onMediaKey('play', a.t);
  assert.deepEqual(a.calls, ['toggle', 'toggle']);
  assert.equal(a.t.playing, true);
  onMediaKey('stop', a.t);
  assert.equal(a.t.playing, false);
});

test('track keys step lines', () => {
  const a = target(false);
  onMediaKey('nexttrack', a.t);
  onMediaKey('previoustrack', a.t);
  assert.deepEqual(a.calls, ['next', 'prev']);
});

function session() {
  const handlers = new Map<MediaKey, (() => void) | null>();
  return { handlers, setActionHandler: (k: MediaKey, h: (() => void) | null) => { handlers.set(k, h); } };
}

test('binding claims every media key for the player and releasing gives them back', () => {
  const ms = session();
  const a = target(true);
  const release = bindMediaKeys(ms, () => a.t);
  assert.deepEqual([...ms.handlers.keys()].sort(), [...MEDIA_KEYS].sort());
  ms.handlers.get('pause')!();
  assert.equal(a.t.playing, false);
  release();
  assert.ok(MEDIA_KEYS.every((k) => ms.handlers.get(k) === null));
});

test('a key always acts on the player as it is now, not as it was when bound', () => {
  const ms = session();
  let current = target(false);
  bindMediaKeys(ms, () => current.t);
  current = target(true);
  ms.handlers.get('pause')!();
  assert.deepEqual(current.calls, ['toggle']);
  assert.equal(current.t.playing, false);
});

test('a browser that refuses some actions still gets the others bound', () => {
  const handlers = new Map<MediaKey, unknown>();
  bindMediaKeys({ setActionHandler: (k, h) => { if (k === 'stop') throw new Error('unsupported'); handlers.set(k, h); } }, () => null);
  assert.equal(handlers.size, MEDIA_KEYS.length - 1);
});

test('pause from the keyboard stops the voice and the background together, and play resumes both in step', () => {
  const ms = session();
  const bed: BedMedia & { plays: number } = { currentTime: 30, paused: false, muted: false, plays: 0, play() { this.plays++; this.paused = false; }, pause() { this.paused = true; } };
  let t = 30;
  const voice = target(true);
  bindMediaKeys(ms, () => voice.t);
  ms.handlers.get('pause')!();
  followBed(bed, { t, playing: voice.t.playing, muted: false });
  assert.equal(voice.t.playing, false);
  assert.equal(bed.paused, true);
  t = 30.1;
  ms.handlers.get('play')!();
  followBed(bed, { t, playing: voice.t.playing, muted: false });
  assert.equal(voice.t.playing, true);
  assert.equal(bed.paused, false);
  assert.equal(bed.currentTime, 30);
});
