import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingClips, originalLines, readsAllOriginal, voicedLines, type LangLine } from '../src/core/voiceplayer.ts';

const mixed: LangLine[] = [
  { sentenceId: 1, language: 'en' },
  { sentenceId: 2, language: 'fr' },
  { sentenceId: 3, language: 'en-US' },
  { sentenceId: 4, language: 'fr-CA' },
  { sentenceId: 5, language: 'fr', unclear: true },
];

test('a mixed recording read in French: the French lines play their original audio, only the English ones are voiced', () => {
  const orig = originalLines(mixed, 'fr', 'en');
  assert.deepEqual([...orig].sort(), [2, 4]);
  assert.deepEqual(voicedLines(mixed, orig), [1, 3]);
  assert.equal(readsAllOriginal(mixed, 'fr', 'en'), false);
});

test('picking the source language of a mixed recording voices its lines in other languages, and only those', () => {
  const orig = originalLines(mixed, 'en', 'en');
  assert.deepEqual([...orig].sort(), [1, 3], 'en-US is the same family as en');
  assert.deepEqual(voicedLines(mixed, orig), [2, 4]);
  assert.equal(readsAllOriginal(mixed, 'en', 'en'), false, 'the reading is not all original, so the voice stays on');
});

test('a recording entirely in the language picked is all original: nothing to voice, nothing missing, nothing to poll for', () => {
  const rows: LangLine[] = [{ sentenceId: 1, language: 'de' }, { sentenceId: 2 }, { sentenceId: 3, language: 'de-AT' }, { sentenceId: 4, language: 'en', suppressed: true }];
  assert.equal(readsAllOriginal(rows, 'de', 'de'), true, 'a line with no language of its own is in the recording language');
  const ids = voicedLines(rows, originalLines(rows, 'de', 'de'));
  assert.deepEqual(ids, []);
  assert.deepEqual(missingClips(ids, new Set()), []);
  assert.equal(readsAllOriginal([], 'de', 'de'), false, 'no lines yet is not a verdict');
});

test('lines the server lists as original are never counted missing, so a mixed reading stops polling once its clips are made', () => {
  const ids = [1, 2, 3, 4];
  assert.deepEqual(missingClips(ids, new Set([1, 3])), [2, 4], 'without the list, the original lines look missing forever');
  assert.deepEqual(missingClips(ids, new Set([1, 3]), [2, 4]), []);
  assert.deepEqual([...originalLines([{ sentenceId: 7, language: 'en' }], 'fr', 'en', [9])], [9], 'the server list is kept even for lines the client cannot place');
});
