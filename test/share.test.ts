import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playIdOf, shareCodeOf } from '../src/core/share.ts';

test('VocalStack share links give their code', () => {
  assert.equal(shareCodeOf('http://localhost:5176/v/459rcv8pfnk7'), '459rcv8pfnk7');
  assert.equal(shareCodeOf('https://app.vocalstack.com/t/hvzbftnkie54?t=30'), 'hvzbftnkie54');
  assert.equal(shareCodeOf('app.vocalstack.com/v/abc123/r/x'), 'abc123');
  assert.equal(shareCodeOf('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(shareCodeOf('https://vimeo.com/123'), null);
});

test('a share URL given as id plays its code, a bare code or a tokened id stays as given', () => {
  assert.equal(playIdOf('https://vocalstack.com/t/hvzbftnkie54', false), 'hvzbftnkie54');
  assert.equal(playIdOf('app.vocalstack.com/v/459rcv8pfnk7?t=3', false), '459rcv8pfnk7');
  assert.equal(playIdOf('459rcv8pfnk7', false), '459rcv8pfnk7');
  assert.equal(playIdOf('tx_123', true), 'tx_123');
  assert.equal(playIdOf(undefined, false), '');
});
