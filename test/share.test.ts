import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareCodeOf } from '../src/core/share.ts';

test('VocalStack share links give their code', () => {
  assert.equal(shareCodeOf('http://localhost:5176/v/459rcv8pfnk7'), '459rcv8pfnk7');
  assert.equal(shareCodeOf('https://app.vocalstack.com/t/hvzbftnkie54?t=30'), 'hvzbftnkie54');
  assert.equal(shareCodeOf('app.vocalstack.com/v/abc123/r/x'), 'abc123');
  assert.equal(shareCodeOf('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(shareCodeOf('https://vimeo.com/123'), null);
});
