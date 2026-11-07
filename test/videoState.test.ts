import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoState } from '../src/core/videoState.ts';

test('a video element reports the states the YouTube lead understands', () => {
  const v = { ended: false, paused: false, seeking: false, readyState: 4 };
  assert.equal(videoState(v), 1, 'playing');
  assert.equal(videoState({ ...v, paused: true }), 2, 'paused');
  assert.equal(videoState({ ...v, readyState: 2 }), 3, 'buffering while it waits for data');
  assert.equal(videoState({ ...v, seeking: true }), 3, 'buffering while it seeks');
  assert.equal(videoState({ ...v, paused: true, ended: true }), 0, 'ended');
});
