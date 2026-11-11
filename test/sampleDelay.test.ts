import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleDelay } from '../src/core/sampleDelay.ts';

test('a sample still being made is asked for again from 2 s, growing to 10 s', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(sampleDelay), [2000, 3000, 4500, 6750, 10000, 10000]);
});
