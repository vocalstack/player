import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteOf, hostOfUrl } from '../src/core/sites.ts';

test('links map to their site', () => {
  assert.equal(siteOf('https://www.loom.com/share/29a5fc11a57846f5ab5a81ef1e24e16d')?.id, 'loom');
  assert.equal(siteOf('youtu.be/abc')?.id, 'youtube');
  assert.equal(siteOf('https://m.youtube.com/watch?v=x')?.id, 'youtube');
  assert.equal(siteOf('https://player.vimeo.com/video/1')?.id, 'vimeo');
  assert.equal(siteOf('https://twitter.com/a/status/1')?.id, 'x');
  assert.equal(siteOf('https://artist.bandcamp.com/track/t')?.id, 'bandcamp');
  assert.equal(siteOf('https://fb.watch/abc')?.id, 'facebook');
  assert.equal(siteOf('https://example.com/a.mp3'), null);
  assert.equal(siteOf('https://notloom.com/x'), null);
  assert.equal(hostOfUrl('https://www.Loom.com/share/x'), 'loom.com');
});
