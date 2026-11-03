import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedUrl, loomId, vimeoIds, dailymotionId, twitchTarget } from '../src/core/embeds.ts';

test('embed ids come out of site links', () => {
  assert.equal(loomId('https://www.loom.com/share/29a5fc11a57846f5ab5a81ef1e24e16d'), '29a5fc11a57846f5ab5a81ef1e24e16d');
  assert.equal(loomId('https://www.loom.com/share/my-talk-29a5fc11a57846f5ab5a81ef1e24e16d?sid=1'), '29a5fc11a57846f5ab5a81ef1e24e16d');
  assert.deepEqual(vimeoIds('https://vimeo.com/123456/abcdef1234'), { id: '123456', h: 'abcdef1234' });
  assert.deepEqual(vimeoIds('https://vimeo.com/channels/staffpicks/987'), { id: '987', h: null });
  assert.equal(dailymotionId('https://www.dailymotion.com/video/x8abc12_some-title'), 'x8abc12');
  assert.equal(dailymotionId('https://dai.ly/x8abc12'), 'x8abc12');
  assert.deepEqual(twitchTarget('https://www.twitch.tv/videos/v123'), { video: '123' });
  assert.deepEqual(twitchTarget('https://clips.twitch.tv/FunnySlug'), { clip: 'FunnySlug' });
  assert.deepEqual(twitchTarget('https://www.twitch.tv/somechannel'), { channel: 'somechannel' });
});

test('embed urls start at the player time, muted', () => {
  const l = embedUrl('https://www.loom.com/share/29a5fc11a57846f5ab5a81ef1e24e16d', { t: 62.7, play: true })!;
  assert.match(l, /^https:\/\/www\.loom\.com\/embed\/29a5fc11a57846f5ab5a81ef1e24e16d\?/);
  assert.match(l, /t=62/); assert.match(l, /muted=true/); assert.match(l, /autoplay=true/);
  assert.match(embedUrl('https://vimeo.com/1', { t: 5, play: false })!, /#t=5s$/);
  assert.equal(embedUrl('https://www.twitch.tv/videos/1', { t: 0, play: true }), null);
  assert.match(embedUrl('https://www.twitch.tv/videos/1', { t: 3725, play: true, host: 'example.com' })!, /time=1h2m5s/);
  assert.equal(embedUrl('https://soundcloud.com/a/b', { t: 0, play: true }), null);
});

test('loom stream requests carry the signature', async () => {
  const { signedLoader } = await import('../src/core/loomStream.ts');
  const calls: string[] = [];
  const xhr = { open: (_m: string, u: string) => { calls.push(u); } } as unknown as XMLHttpRequest;
  const load = signedLoader('https://luna.loom.com/id/x/rev/1/resource/hls/playlist.m3u8?Policy=p&Signature=s&Key-Pair-Id=k');
  load(xhr, 'https://luna.loom.com/id/x/rev/1/resource/hls/video_720.m3u8');
  load(xhr, 'https://luna.loom.com/id/x/rev/1/resource/hls/seg1.ts?Policy=p&Signature=s&Key-Pair-Id=k');
  assert.deepEqual(calls, ['https://luna.loom.com/id/x/rev/1/resource/hls/video_720.m3u8?Policy=p&Signature=s&Key-Pair-Id=k']);
});
