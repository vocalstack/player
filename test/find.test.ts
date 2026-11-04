import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCount, findMatches, matchAt, stepMatch, type FindRow } from '../src/core/find.ts';

const rows: FindRow[] = [
  { id: 'a', text: 'In the west of Africa.', translations: { ro: 'În vestul Africii.' } },
  { id: 'b', text: 'Salt was money.', translations: { ro: 'Sarea era bani.' } },
  { id: 'c', text: 'Gold won the race.', translations: {} },
  { id: 'd', text: 'Money must be scarce.', translations: { ro: 'Banii trebuie râvniți.' } },
];

test('matches are the rows whose text holds the query, ignoring case and outer spaces', () => {
  assert.deepEqual(findMatches(rows, '  MONEY '), [1, 3]);
  assert.deepEqual(findMatches(rows, ''), []);
  assert.deepEqual(findMatches(rows, '   '), []);
  assert.deepEqual(findMatches(rows, 'nowhere'), []);
});

test('the shown translation matches too, other languages do not', () => {
  assert.deepEqual(findMatches(rows, 'bani', 'ro'), [1, 3]);
  assert.deepEqual(findMatches(rows, 'bani'), []);
  assert.deepEqual(findMatches(rows, 'bani', 'fr'), []);
});

test('stepping wraps around both ways', () => {
  assert.equal(stepMatch(0, 3, 1), 1);
  assert.equal(stepMatch(2, 3, 1), 0);
  assert.equal(stepMatch(0, 3, -1), 2);
  assert.equal(stepMatch(1, 3, -1), 0);
  assert.equal(stepMatch(0, 1, 1), 0);
  assert.equal(stepMatch(-1, 3, 1), 0);
  assert.equal(stepMatch(-1, 3, -1), 2);
  assert.equal(stepMatch(0, 0, 1), -1);
});

test('the current match follows its row when rows change, else falls back to the first', () => {
  const m = findMatches(rows, 'money');
  assert.equal(matchAt(rows, m, 'd'), 1);
  assert.equal(matchAt(rows, m, 'a'), 0);
  assert.equal(matchAt(rows, m, null), 0);
  assert.equal(matchAt(rows, [], 'd'), -1);
  const grown: FindRow[] = [{ id: 'z', text: 'More money first.' }, ...rows];
  assert.equal(matchAt(grown, findMatches(grown, 'money'), 'd'), 2);
});

test('the count reads n / total, or 0 found', () => {
  assert.equal(findCount(0, 3), '1 / 3');
  assert.equal(findCount(2, 3), '3 / 3');
  assert.equal(findCount(-1, 0), '0 found');
});
