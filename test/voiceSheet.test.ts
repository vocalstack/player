import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSelection } from '../src/core/voiceSheet.ts';

test('clicking the selected speaker again clears the selection', () => {
  assert.equal(nextSelection(2, 2), null, 'the selected chip again: no speaker selected');
  assert.equal(nextSelection(2, 3), 3);
  assert.equal(nextSelection(null, 3), 3, 'from no selection, a click selects');
});
