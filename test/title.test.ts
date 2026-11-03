import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayName } from '../src/data/title.ts';

const id = '01a1a073-99a3-7ed0-807a-6e7020ccec47';

test('a transcription id is never shown as the title', () => {
  assert.equal(displayName({ name: id, id }), 'VocalStack');
  assert.equal(displayName({ name: '', sourceName: null, id }), 'VocalStack');
});

test('the title comes from the name, then the source, then YouTube, then the host', () => {
  assert.equal(displayName({ name: 'Talk', sourceName: 'file.mp4', id }), 'Talk');
  assert.equal(displayName({ name: id, sourceName: 'Keynote 2026', id }), 'Keynote 2026');
  assert.equal(displayName({ name: null, ytTitle: 'Some video', url: 'https://youtu.be/x', id }), 'Some video');
  assert.equal(displayName({ name: null, url: 'https://www.vimeo.com/123', id }), 'vimeo.com');
  assert.equal(displayName({ id: 'r4m4srrrhi24' }), 'r4m4srrrhi24');
});
