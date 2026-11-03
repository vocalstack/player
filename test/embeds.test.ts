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

test('a share link rebuilds the video address from its embed id', async () => {
  const { urlFromEmbed, sourceVideoUrl } = await import('../src/core/embeds.ts');
  assert.equal(urlFromEmbed('loom', '29a5fc11a57846f5ab5a81ef1e24e16d'), 'https://www.loom.com/share/29a5fc11a57846f5ab5a81ef1e24e16d');
  assert.equal(urlFromEmbed('vimeo', '123/abcdef12'), 'https://vimeo.com/123/abcdef12');
  assert.equal(urlFromEmbed('twitch', 'v42'), 'https://www.twitch.tv/videos/42');
  assert.equal(urlFromEmbed('twitch', 'clip:Funny'), 'https://clips.twitch.tv/Funny');
  assert.equal(urlFromEmbed('loom', 'nope'), null);
  assert.equal(sourceVideoUrl({ kind: 'url', url: 'https://www.loom.com', site: 'loom', embedId: '29a5fc11a57846f5ab5a81ef1e24e16d' }), 'https://www.loom.com/share/29a5fc11a57846f5ab5a81ef1e24e16d');
  assert.equal(sourceVideoUrl({ kind: 'url', url: 'https://youtu.be/abc123' }), 'https://youtu.be/abc123');
});

test('social site embeds', async () => {
  const { embedUrl, urlFromEmbed, sourceVideoUrl } = await import('../src/core/embeds.ts');
  assert.match(embedUrl('https://www.tiktok.com/@patroxofficial/video/6742501081818877190', { t: 0, play: true })!, /tiktok\.com\/embed\/v2\/6742501081818877190/);
  assert.match(embedUrl('https://x.com/SpaceX/status/1732824684683784516', { t: 0, play: true })!, /Tweet\.html\?id=1732824684683784516/);
  assert.match(embedUrl('https://www.instagram.com/p/aye83DjauH/', { t: 0, play: true })!, /instagram\.com\/p\/aye83DjauH\/embed/);
  assert.match(embedUrl('https://kick.com/SomeOne', { t: 0, play: true })!, /player\.kick\.com\/someone/);
  assert.match(embedUrl('https://streamable.com/dnd1', { t: 3, play: true })!, /streamable\.com\/e\/dnd1/);
  assert.equal(urlFromEmbed('x', '1732824684683784516'), 'https://x.com/i/status/1732824684683784516');
  assert.match(sourceVideoUrl({ kind: 'url', url: 'https://www.facebook.com', site: 'facebook', embedId: '274175099429670' })!, /watch\/\?v=274175099429670/);
});

test('more site embeds', async () => {
  const { embedUrl, urlFromEmbed } = await import('../src/core/embeds.ts');
  assert.equal(embedUrl('https://www.ted.com/talks/candace_parker_how_to_break_down_barriers', { t: 0, play: false }), 'https://embed.ted.com/talks/candace_parker_how_to_break_down_barriers');
  assert.match(embedUrl('https://drive.google.com/file/d/1AbC_d/view?usp=sharing', { t: 0, play: false })!, /file\/d\/1AbC_d\/preview/);
  assert.match(embedUrl('https://bsky.app/profile/bsky.app/post/3l3vgf77uco2g', { t: 0, play: false })!, /embed\.bsky\.app\/embed\/bsky\.app\/app\.bsky\.feed\.post\/3l3vgf77uco2g/);
  assert.match(embedUrl('https://archive.org/details/XD300-23_68HomerSongs', { t: 0, play: false })!, /archive\.org\/embed\/XD300-23_68HomerSongs/);
  assert.match(embedUrl('https://odysee.com/@Mantega:1/First-day-in-SF:1', { t: 5, play: true })!, /odysee\.com\/\$\/embed\/@Mantega:1\/First-day-in-SF:1/);
  assert.match(embedUrl('https://fast.wistia.net/embed/iframe/abc123xyz', { t: 0, play: false })!, /fast\.wistia\.net\/embed\/iframe\/abc123xyz/);
  assert.equal(urlFromEmbed('ted', 'some_talk'), 'https://www.ted.com/talks/some_talk');
});
