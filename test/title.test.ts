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

test('a link id used as a name gives way to the real title', () => {
  assert.equal(displayName({ name: '29a5fc11a57846f5ab5a81ef1e24e16d', sourceName: 'How to Handle High Level B2C', id }), 'How to Handle High Level B2C');
});

test('media links carry the media token', async () => {
  const { deliveryAudioUrl, audioDownloadUrl, backgroundAudioUrl } = await import('../src/core/audio.ts');
  for (const u of [deliveryAudioUrl('https://a', 'r', { media: 'm1', accessToken: 't' }), audioDownloadUrl('https://a', 'r', 'source', { media: 'm1' }), backgroundAudioUrl('https://a', 'r', { media: 'm1' })]) {
    assert.match(u, /[?&]media=m1(&|$)/);
    assert.doesNotMatch(u, /access_token/);
  }
  assert.match(audioDownloadUrl('https://a', 'r', 'video', { accessToken: 't' }), /access_token=t/);
});
