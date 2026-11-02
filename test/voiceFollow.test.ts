import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followTarget, upcomingSrcs, type FollowClip, type FollowLine } from '../src/core/voiceFollow.ts';

const lines: FollowLine[] = [
  { sid: 0, start: 10, end: 14 },
  { sid: 1, start: 14, end: 20 },
  { sid: 2, start: 25, end: 30 },
];
const clip = (src: string, part = 0, parts = 1, durationS = 3): FollowClip => ({ src, part, parts, durationS });
const map = (e: [number, FollowClip[]][]) => new Map(e);

test('the voice heard is the clip of the line under the video, from where the video is in it', () => {
  const c = map([[0, [clip('a')]], [1, [clip('b')]]]);
  assert.deepEqual(followTarget(lines, c, 11.5), { kind: 'play', sid: 0, src: 'a', offset: 1.5 });
  assert.deepEqual(followTarget(lines, c, 14), { kind: 'play', sid: 1, src: 'b', offset: 0 });
});

test('a line whose voice is not ready yet is silent and says so; when it arrives it comes in at the video time', () => {
  assert.deepEqual(followTarget(lines, map([]), 16), { kind: 'missing', sid: 1 });
  assert.deepEqual(followTarget(lines, map([[1, [clip('b', 0, 1, 5)]]]), 16), { kind: 'play', sid: 1, src: 'b', offset: 2 });
});

test('a long line read in parts plays the part the video has reached', () => {
  const c = map([[1, [clip('b0', 0, 2, 2), clip('b1', 1, 2, 3)]]]);
  assert.deepEqual(followTarget(lines, c, 15), { kind: 'play', sid: 1, src: 'b0', offset: 1 });
  assert.deepEqual(followTarget(lines, c, 16.5), { kind: 'play', sid: 1, src: 'b1', offset: 0.5 });
  assert.deepEqual(followTarget(lines, map([[1, [clip('b0', 0, 2, 2)]]]), 16.5), { kind: 'missing', sid: 1 });
});

test('after a line has been spoken, and between lines, nothing plays', () => {
  const c = map([[1, [clip('b', 0, 1, 2)]]]);
  assert.deepEqual(followTarget(lines, c, 17), { kind: 'done', sid: 1 });
  assert.deepEqual(followTarget(lines, c, 22), { kind: 'none' });
  assert.deepEqual(followTarget(lines, c, 5), { kind: 'none' });
});

test('the clips of the line playing and the next ones are loaded ahead', () => {
  const c = map([[0, [clip('a')]], [1, [clip('b')]], [2, [clip('c')]]]);
  assert.deepEqual(upcomingSrcs(lines, c, 11, 1), ['a', 'b']);
  assert.deepEqual(upcomingSrcs(lines, c, 26), ['c']);
});
