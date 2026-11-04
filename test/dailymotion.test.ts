import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILYMOTION_PLAYER, dailymotionFrame, dailymotionLib, dailymotionPlayerId, dmLoud, dmStep } from '../src/core/dailymotion.ts';
import { embedUrl } from '../src/core/embeds.ts';

test('dailymotion embeds carry a player id: the id-less player answers 403', () => {
  assert.equal(dailymotionLib(), `https://geo.dailymotion.com/libs/player/${DAILYMOTION_PLAYER}.js`);
  assert.equal(dailymotionLib('xabc12'), 'https://geo.dailymotion.com/libs/player/xabc12.js');
  assert.equal(dailymotionPlayerId('../evil'), DAILYMOTION_PLAYER);
  assert.equal(dailymotionPlayerId(''), DAILYMOTION_PLAYER);
  const f = dailymotionFrame('x8jq4o2', { t: 10.7, play: true });
  assert.match(f, new RegExp(`^https://geo\\.dailymotion\\.com/player/${DAILYMOTION_PLAYER}\\.html\\?`));
  assert.match(f, /video=x8jq4o2/); assert.match(f, /mute=true/); assert.match(f, /startTime=10/); assert.match(f, /autoplay=true/);
  const e = embedUrl('https://www.dailymotion.com/video/x8jq4o2', { t: 3, play: false })!;
  assert.doesNotMatch(e, /dailymotion\.com\/embed\/|player\.html/);
  assert.match(e, /geo\.dailymotion\.com\/player\/x[a-z0-9]+\.html\?video=x8jq4o2/);
});

test('dailymotion follows the VocalStack clock', () => {
  const want = { video: 'x8jq4o2', t: 20, playing: true };
  assert.deepEqual(dmStep({ videoTime: 20.4, playerIsPlaying: true, videoId: 'x8jq4o2' }, want), { kind: 'none' });
  assert.deepEqual(dmStep({ videoTime: 5, playerIsPlaying: true, videoId: 'x8jq4o2' }, want), { kind: 'seek', to: 20 });
  assert.deepEqual(dmStep({ videoTime: 20, playerIsPlaying: false, videoId: 'x8jq4o2' }, want), { kind: 'play' });
  assert.deepEqual(dmStep({ videoTime: 0, playerIsPlaying: true, adIsPlaying: true, videoId: 'x8jq4o2' }, want), { kind: 'none' });
  assert.deepEqual(dmStep({ videoTime: 3, playerIsPlaying: true, videoId: 'xother1' }, want), { kind: 'reload' });
  assert.deepEqual(dmStep({ videoTime: 20, playerIsPlaying: true, videoId: 'x8jq4o2' }, { ...want, playing: false }), { kind: 'pause' });
  assert.deepEqual(dmStep({ videoTime: 20, playerIsPlaying: false }, { ...want, playing: false }), { kind: 'none' });
  assert.deepEqual(dmStep({ videoTime: 189, playerIsPlaying: true, videoDuration: 189 }, { ...want, t: 200 }), { kind: 'pause' });
  assert.deepEqual(dmStep({ videoTime: 20, playerIsPlaying: true, playerIsReplayScreen: true }, want), { kind: 'play' });
  assert.deepEqual(dmStep({ videoTime: 21.2, playerIsPlaying: true, videoId: 'x8jq4o2' }, want), { kind: 'none' });
  assert.deepEqual(dmStep({ videoTime: 5, playerIsPlaying: false, playerIsBuffering: true }, want), { kind: 'none' });
  assert.deepEqual(dmStep({ videoTime: 5, playerIsPlaying: true }, { ...want, settling: true }), { kind: 'none' });
});

test('dailymotion is kept silent: it unmutes itself once the page has had a click', () => {
  assert.equal(dmLoud({ playerIsMuted: false, playerVolume: 1 }), true);
  assert.equal(dmLoud({ playerIsMuted: true, playerVolume: 1 }), true);
  assert.equal(dmLoud({ playerIsMuted: true, playerVolume: 0 }), false);
  assert.equal(dmLoud({}), false);
  assert.equal(dmLoud(null), false);
});
