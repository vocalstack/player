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

test('clicking the selected speaker again unselects it; another speaker selects that one', async () => {
  const { nextSelection } = await import('../src/core/voiceSheet.ts');
  assert.equal(nextSelection(2, 2), null, 'the selected chip again: no speaker selected');
  assert.equal(nextSelection(2, 3), 3);
  assert.equal(nextSelection(null, 3), 3, 'from no selection, a click selects');
});

test('the deselect hook clears the selected speaker whenever its value changes, not when it first arrives', async () => {
  const { deselectChanged } = await import('../src/core/voiceSheet.ts');
  assert.equal(deselectChanged(undefined, undefined), false);
  assert.equal(deselectChanged(0, 0), false, 'the same value: the selection stays');
  assert.equal(deselectChanged(0, 1), true, 'bumped: cleared');
  assert.equal(deselectChanged(1, 2), true);
  assert.equal(deselectChanged(undefined, 1), true, 'a value that appears later counts as a change');
  assert.equal(deselectChanged(1, undefined), false, 'the hook going away clears nothing');
});

test('with no speaker selected the overview replaces the voice list; without the hook or with a speaker selected, the list stays', async () => {
  const { overviewShown } = await import('../src/core/voiceSheet.ts');
  assert.equal(overviewShown({ hook: true, castOn: true, selected: null }), true);
  assert.equal(overviewShown({ hook: true, castOn: true, selected: 2 }), false, 'a speaker selected: their voices');
  assert.equal(overviewShown({ hook: false, castOn: true, selected: null }), false, 'no hook: today’s unselected panel');
  assert.equal(overviewShown({ hook: true, castOn: false, selected: null }), false, 'one speaker, no chips: the list as before');
});
