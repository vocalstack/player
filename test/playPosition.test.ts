import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePosition, snapPosition } from '../src/core/playPosition.ts';

const src = [
  { sentenceId: 1, start: 0 },
  { sentenceId: 2, start: 5 },
  { sentenceId: 3, start: 12 },
  { sentenceId: 4, start: 20 },
];
const DUR = 30;
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('same timeline: the same media time, sentence and play state', () => {
  const p = snapPosition(src, 7.5, true, DUR);
  assert.equal(p.sentenceId, 2);
  near(p.offset, 2.5);
  const at = placePosition(p, src, DUR);
  near(at.t, 7.5);
  assert.equal(at.playing, true);
  assert.equal(at.index, 1);
});

test('a track laid out differently maps to the same sentence at the same offset', () => {
  const voice = [
    { sentenceId: 1, start: 0 },
    { sentenceId: 2, start: 3 },
    { sentenceId: 3, start: 10 },
    { sentenceId: 4, start: 16 },
  ];
  const at = placePosition(snapPosition(src, 7.5, true, DUR), voice, 25);
  near(at.t, 5.5);
  assert.equal(at.index, 1);
  assert.equal(at.playing, true);
});

test('the offset is clamped to the length of the sentence in the new track', () => {
  const short = [
    { sentenceId: 1, start: 0 },
    { sentenceId: 2, start: 4 },
    { sentenceId: 3, start: 5 },
    { sentenceId: 4, start: 8 },
  ];
  const at = placePosition(snapPosition(src, 11, false, DUR), short, 12);
  assert.equal(at.index, 1);
  assert.ok(at.t >= 4 && at.t < 5, `t ${at.t} left sentence 2`);
});

test('switching while paused stays paused at the same place', () => {
  const at = placePosition(snapPosition(src, 13, false, DUR), src, DUR);
  near(at.t, 13);
  assert.equal(at.playing, false);
  assert.equal(at.index, 2);
});

test('switching at the very end stays at the end, not playing', () => {
  const p = snapPosition(src, DUR, false, DUR);
  assert.equal(p.ended, true);
  const at = placePosition(p, src, 26);
  near(at.t, 26);
  assert.equal(at.playing, false);
  assert.equal(at.index, 3);
});

test('Original to a translation and back keeps the sentence and offset', () => {
  const tr = src.map((r) => ({ ...r, start: r.start * 1.2 }));
  const there = placePosition(snapPosition(src, 14, true, DUR), tr, DUR * 1.2);
  assert.equal(there.index, 2);
  near(there.t, 14.4 + 2);
  const back = placePosition(snapPosition(tr, there.t, there.playing, DUR * 1.2), src, DUR);
  near(back.t, 14);
  assert.equal(back.playing, true);
  assert.equal(back.index, 2);
});

test('a sentence missing from the new track falls back to the same media time', () => {
  const at = placePosition(snapPosition(src, 13, true, DUR), src.filter((r) => r.sentenceId !== 3), DUR);
  near(at.t, 13);
  assert.equal(at.index, 1);
  assert.equal(at.playing, true);
});
