import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speakerExtra, underAt } from '../src/core/voiceSheet.ts';

type Sp = { key: number; name: string };
const julia: Sp = { key: 1, name: 'Julia' };
const heads = ['VOICE', 'VOICE', 'MALE', 'FEMALE'];

test('a speaker node is drawn once, under the VOICE list, for the selected speaker', () => {
  const asked: number[] = [];
  const node = speakerExtra((sp: Sp) => { asked.push(sp.key); return `Not ${sp.name}`; }, julia);
  assert.equal(node, 'Not Julia');
  assert.deepEqual(asked, [1], 'asked once, for the selected speaker');
  const at = underAt(heads, 'VOICE', node != null);
  assert.equal(at, 1, 'after the last VOICE row, before the stock groups');
  assert.equal(heads.filter((_, i) => i === at).length, 1, 'one place only');
  assert.equal(underAt(['MALE', 'FEMALE'], 'VOICE', true), -1, 'no VOICE rows: drawn above the list');
});

test('a speaker node that returns null, no selected speaker or no hook draws nothing', () => {
  assert.equal(speakerExtra(() => null, julia), null);
  assert.equal(speakerExtra(() => undefined, julia), null);
  assert.equal(speakerExtra((sp: Sp) => sp.name, null), null);
  assert.equal(speakerExtra(undefined, julia), null);
  assert.equal(underAt(heads, 'VOICE', false), null, 'nothing to place');
});
