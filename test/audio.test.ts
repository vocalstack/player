import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaKindOf } from '../src/core/audio.ts';

test('a media error names what failed to play, never its credentials', () => {
  assert.equal(mediaKindOf('https://api.vocalstack.com/v1/recordings/r1/audio?kind=delivery&format=ogg&access_token=secret'), 'delivery ogg');
  assert.equal(mediaKindOf('https://api.vocalstack.com/v1/recordings/r1/audio?kind=voice&lang=ro&format=caf&shareCode=abc'), 'voice caf ro');
  assert.equal(mediaKindOf('https://api.vocalstack.com/v1/recordings/r1/voice/12?lang=en&voice=x'), '12 en');
  assert.equal(mediaKindOf('/v1/recordings/r1/audio?kind=source&access_token=secret'), 'source', 'a relative link too');
});
