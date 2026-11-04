import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromStream, spanGaps, toStream } from '../src/core/streamTime.ts';

test('a recording with no pause maps to the stream by its start offset', () => {
  const g = spanGaps([{ wallStart: 0.1, mediaStart: 0 }]);
  assert.deepEqual(g, []);
  assert.equal(toStream(12, 2915, g), 2927);
  assert.equal(fromStream(2927, 2915, g), 12);
});

test('a pause shifts the stream time by the wall time it lasted', () => {
  const g = spanGaps([{ wallStart: 0, wallEnd: 60, mediaStart: 0 }, { wallStart: 90, mediaStart: 60 }]);
  assert.deepEqual(g, [{ at: 60, shift: 30 }]);
  assert.equal(toStream(30, 100, g), 130);
  assert.equal(toStream(70, 100, g), 200);
  assert.equal(fromStream(200, 100, g), 70);
  assert.equal(fromStream(130, 100, g), 30);
  assert.equal(fromStream(175, 100, g), 60);
});
