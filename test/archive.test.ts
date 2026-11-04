import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveTarget, archiveVideoFile } from '../src/core/archive.ts';
import { hasEmbed } from '../src/core/embeds.ts';

const DUCK = { metadata: { mediatype: 'movies' }, files: [
  { name: 'DuckandC1951.avi', format: 'Cinepack', source: 'original' },
  { name: 'DuckandC1951.ia.mp4', format: 'h.264 IA', source: 'derivative', height: '480' },
  { name: 'DuckandC1951.mp4', format: 'MPEG4', source: 'derivative', height: '480' },
  { name: 'DuckandC1951.ogv', format: 'Ogg Video', source: 'derivative', height: '300' },
  { name: 'DuckandC1951_512kb.mp4', format: '512Kb MPEG4', source: 'derivative', height: '240' },
  { name: 'DuckandC1951_edit.mp4', format: 'HiRes MPEG4', source: 'derivative', height: '240' },
] };

test('an archive.org item plays its own mp4 derivative', () => {
  assert.equal(archiveVideoFile('DuckandC1951', DUCK), 'https://archive.org/download/DuckandC1951/DuckandC1951.ia.mp4');
  assert.equal(archiveVideoFile('DuckandC1951', { files: DUCK.files.filter((f) => f.format !== 'h.264 IA') }), 'https://archive.org/download/DuckandC1951/DuckandC1951.mp4');
  assert.equal(archiveVideoFile('Talk', { metadata: { mediatype: 'audio' }, files: [{ name: 'talk.mp3', format: 'VBR MP3' }] }), null);
  assert.equal(archiveVideoFile('Two', { files: [{ name: 'a.mp4', format: 'h.264' }, { name: 'b.mp4', format: 'h.264' }, { name: 'b.avi', format: 'Cinepack', source: 'original' }] }, 'b.avi'), 'https://archive.org/download/Two/b.mp4');
  assert.equal(archiveVideoFile('Sp', { files: [{ name: 'my talk.mp4', format: 'h.264' }] }), 'https://archive.org/download/Sp/my%20talk.mp4');
  assert.equal(archiveVideoFile('bad/id', DUCK), null);
  assert.equal(archiveVideoFile('DuckandC1951', null), null);
});

test('archive.org links name their item', () => {
  assert.deepEqual(archiveTarget('https://archive.org/details/DuckandC1951'), { id: 'DuckandC1951', file: null });
  assert.deepEqual(archiveTarget('https://archive.org/details/Two/b.avi'), { id: 'Two', file: 'b.avi' });
  assert.deepEqual(archiveTarget('https://archive.org/embed/DuckandC1951'), { id: 'DuckandC1951', file: null });
  assert.equal(archiveTarget('https://archive.org'), null);
  assert.equal(archiveTarget('https://example.com/details/x'), null);
  assert.equal(hasEmbed('https://archive.org/details/DuckandC1951'), true);
});
