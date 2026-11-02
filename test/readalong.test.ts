import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spreadWords, subtitleShown, lineSpeechEnd, SUB_LEAD_S, SUB_LINGER_S } from '../src/core/readalong.ts';

const w = (start: number, end: number) => ({ start, end });
const rows = [
  { start: 18.16, end: 20.15, words: [w(18.16, 18.25), w(18.25, 18.56), w(19.8, 20.15)] },
  { start: 20.48, end: 26.08, words: [w(20.48, 20.64), w(21.46, 21.7), w(25.52, 26.08)] },
  { start: 32.68, end: 34.44, words: [w(32.68, 32.78), w(34.27, 34.44)] },
];

test('the first subtitle is not up before the first word', () => {
  assert.equal(subtitleShown(rows, 0, 0.2), false);
  assert.equal(subtitleShown(rows, 0, 10), false);
  assert.equal(subtitleShown(rows, 0, 18.16 - SUB_LEAD_S - 0.01), false);
  assert.equal(subtitleShown(rows, 0, 18.16 - SUB_LEAD_S + 0.01), true);
  assert.equal(subtitleShown(rows, 0, 19), true);
});

test('a line goes after its last word, and never overlaps the next one', () => {
  assert.equal(subtitleShown(rows, 1, 26.08 + SUB_LINGER_S - 0.01), true);
  assert.equal(subtitleShown(rows, 1, 26.08 + SUB_LINGER_S + 0.01), false);
  assert.equal(subtitleShown(rows, 1, 30), false);
  assert.equal(subtitleShown(rows, 0, 20.3), false);
  assert.equal(subtitleShown(rows, 1, 20.3), true);
});

test('without word times a line still ends at its segments, not the next line', () => {
  const bare = rows.map((r) => ({ ...r, words: [] }));
  assert.equal(lineSpeechEnd(bare[1], bare[2], 99), 26.08);
  assert.equal(subtitleShown(bare, 1, 30), false);
});

test('untimed words are spread over the line by their length', () => {
  const s = spreadWords(['a', 'converted.'], 10, 15.5);
  assert.equal(s[0].start, 10);
  assert.ok(Math.abs(s[0].end - 10.55) < 1e-9);
  assert.ok(Math.abs(s[1].end - 15.5) < 1e-9);
});
