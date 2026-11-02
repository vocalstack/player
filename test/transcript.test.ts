import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFrame, empty, heldLine, rows, speakerInitial, speakerLabel, speakerLook, speakerName, speakerNumber } from '../src/core/transcript.ts';

const committed = (seq: number, start: number, text: string) => ({
  type: 'transcript.committed',
  segment: {
    seq, speaker: 0, start, end: start + 2, text,
    words: text.split(' ').map((t, i) => ({ text: t, start: start + i * 0.2, end: start + i * 0.2 + 0.2, prob: 0.9 })),
  },
});
const sentence = (seqs: number[], text: string) => ({
  type: 'transcript.sentence',
  sentence: { sentenceId: 13, seqs, text, start: 84.71, end: 97.32, speaker: 0, status: 'open' },
});

test('a sentence missing one of its segments reads as its own text', () => {
  let m = empty();
  m = applyFrame(m, committed(15, 89.9, 'of the older model because'));
  m = applyFrame(m, committed(16, 92.62, 'the response to me speaking is quite fast.'));
  const text = 'It seems quite responsive instead of the older model because the response to me speaking is quite fast.';
  m = applyFrame(m, sentence([14, 15, 16], text));
  const [row] = rows(m);
  assert.equal(row.text, text);
  assert.deepEqual(row.words, [], 'no per-word line that would leave the start out');
});

test('held text shows a placeholder until its rows come', () => {
  let m = empty();
  m = applyFrame(m, committed(0, 1, 'Hello everyone'));
  m = applyFrame(m, sentence([0], 'Hello everyone'));
  m = applyFrame(m, { type: 'transcript.held', held: true, fromMediaS: 100, language: 'fr' });
  assert.equal(heldLine(m), 'French · transcribing…');
  assert.deepEqual(rows(m).map((r) => r.id), ['s:13'], 'not a row');
  m = applyFrame(m, { type: 'transcript.held', held: false, fromMediaS: 100, outcome: 'moved' });
  assert.equal(heldLine(m), null);
});

test('a sentence with all its segments reads word by word', () => {
  let m = empty();
  m = applyFrame(m, committed(14, 84.71, 'It seems quite responsive'));
  m = applyFrame(m, committed(15, 89.9, 'of the older model because'));
  m = applyFrame(m, sentence([14, 15], 'It seems quite responsive of the older model because'));
  const [row] = rows(m);
  assert.equal(row.words.map((w) => w.text).join(' '), 'It seems quite responsive of the older model because');
});

const spoken = (sentenceId: number, start: number, speaker: number, text = 'Amin.') => ({
  type: 'transcript.sentence',
  sentence: { sentenceId, seqs: [], text, start, end: start + 2, speaker, status: 'closed' },
});

test('speakers are numbered in the order they first speak, not by their raw id', () => {
  let m = empty();
  m = applyFrame(m, spoken(1, 0, 27));
  m = applyFrame(m, spoken(2, 5, 4));
  m = applyFrame(m, spoken(3, 9, 27));
  m = applyFrame(m, spoken(4, 12, 13));
  assert.equal(speakerLabel(m, 27), 'Speaker 1');
  assert.equal(speakerLabel(m, 4), 'Speaker 2');
  assert.equal(speakerLabel(m, 13), 'Speaker 3');
  assert.equal(speakerInitial(m, 13), 'S3');
});

test('the highest speaker number is the number of speakers shown', () => {
  let m = empty();
  const ids = [3, 9, 27, 3, 14, 9, 21, 0, 27];
  ids.forEach((spk, i) => { m = applyFrame(m, spoken(i + 1, i * 4, spk)); });
  const shown = new Set(rows(m).map((r) => r.speaker));
  const numbers = [...shown].map((s) => speakerNumber(m, s)).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: shown.size }, (_, i) => i + 1));
});

test('a sentence arriving out of order renumbers by time', () => {
  let m = empty();
  m = applyFrame(m, spoken(2, 10, 8));
  assert.equal(speakerLabel(m, 8), 'Speaker 1');
  m = applyFrame(m, spoken(1, 2, 5));
  assert.equal(speakerLabel(m, 5), 'Speaker 1');
  assert.equal(speakerLabel(m, 8), 'Speaker 2');
});

test('a speaker relabelled away from its lines gives up its number', () => {
  let m = empty();
  m = applyFrame(m, spoken(1, 0, 6));
  m = applyFrame(m, spoken(2, 4, 11));
  m = applyFrame(m, spoken(3, 8, 2));
  assert.equal(speakerLabel(m, 2), 'Speaker 3');
  m = applyFrame(m, spoken(2, 4, 6));
  assert.equal(speakerLabel(m, 2), 'Speaker 2');
});

test('a named speaker keeps its name and still holds its number', () => {
  let m = empty();
  m = applyFrame(m, spoken(1, 0, 19));
  m = applyFrame(m, spoken(2, 3, 7));
  m = applyFrame(m, { type: 'transcript.speakerNamed', speaker: 19, name: 'Pastor Ion' });
  assert.equal(speakerLabel(m, 19), 'Pastor Ion');
  assert.equal(speakerInitial(m, 19), 'PI');
  assert.equal(speakerLabel(m, 7), 'Speaker 2');
});

test('a known speaker with no lines yet is numbered after everyone heard', () => {
  let m = empty();
  m = applyFrame(m, spoken(1, 0, 12));
  m = applyFrame(m, { type: 'transcript.speakerIdentified', speaker: 30, name: 'Maria' });
  assert.equal(speakerNumber(m, 12), 1);
  assert.equal(speakerNumber(m, 30), 2);
  m = applyFrame(m, spoken(2, 6, 30));
  assert.equal(speakerNumber(m, 30), 2);
});

test('speaker colours follow the new numbers so the first speakers get distinct lanes', () => {
  let m = empty();
  [8, 16, 24].forEach((spk, i) => { m = applyFrame(m, spoken(i + 1, i, spk)); });
  const lanes = [8, 16, 24].map((s) => speakerLook(m, s).lane);
  assert.equal(new Set(lanes).size, 3);
});

test('an automatic clone named after the raw id does not bring the raw number back', () => {
  let m = empty();
  m = applyFrame(m, spoken(1, 0, 4));
  m = applyFrame(m, spoken(2, 5, 27));
  m = applyFrame(m, { type: 'transcript.speakerIdentified', speaker: 27, name: 'Speaker 28', voiceId: 'v1' });
  assert.equal(speakerLabel(m, 27), 'Speaker 2');
  assert.equal(speakerInitial(m, 27), 'S2');
  assert.equal(speakerName(m, 27), undefined);
  assert.equal(speakerLook(m, 27).hasVoice, true, 'still linked to its voice');
  m = applyFrame(m, { type: 'transcript.speakerNamed', speaker: 27, name: 'Speaker 28' });
  assert.equal(speakerLabel(m, 27), 'Speaker 2');
  m = applyFrame(m, { type: 'transcript.speakerNamed', speaker: 27, name: 'Speakers Corner' });
  assert.equal(speakerLabel(m, 27), 'Speakers Corner');
});
