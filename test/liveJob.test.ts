import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryKept, liveJob, sourceOf } from '../src/data/live.ts';

const sealedDelivery = [
  { kind: 'delivery', codec: 'opus', container: 'ogg', bytes: 167853, durationS: 57.5, state: 'sealed' },
  { kind: 'delivery_mp3', codec: 'mp3', container: 'mp3', bytes: 900000, state: 'sealed' },
  { kind: 'delivery_caf', codec: 'opus', container: 'caf', bytes: 170000, state: 'sealed' },
];
const mic = (state: string, media: unknown[] | null | undefined = sealedDelivery) =>
  ({ id: 'tx-1', live: true, state, source: { kind: 'mic' }, ingest: null, media, job: null }) as never;

test('a finished microphone recording plays its delivery audio: a job with hasAudio and no link', () => {
  const job = sourceOf(mic('finalized')) as unknown as Record<string, unknown>;
  assert.ok(job, 'a live transcription with no link still gets a job once its audio is kept');
  assert.equal(job.hasAudio, true);
  assert.equal(job.hasVideo, false);
  assert.equal(job.state, 'done');
  assert.equal(job.source, undefined, 'no source, so the player asks for kind=delivery, never kind=source');
  assert.deepEqual(job.crop, { startS: 0 });
});

test('a microphone recording still on air has no job, as before', () => {
  for (const s of ['idle', 'pending', 'live', 'paused']) {
    assert.equal(sourceOf(mic(s, [])), null, s);
    assert.equal(sourceOf(mic(s)), null, `${s}, even with a sealed delivery listed`);
  }
});

test('a microphone recording that has stopped but is not final yet counts as having audio (the player waits for it to be sealed)', () => {
  assert.equal(deliveryKept(mic('ended', [])), true);
  assert.equal(deliveryKept(mic('processing', [])), true);
});

test('a final microphone recording whose media list has no sealed delivery has no audio', () => {
  assert.equal(sourceOf(mic('finalized', [])), null);
  assert.equal(sourceOf(mic('finalized', [{ kind: 'delivery', codec: 'opus', container: 'ogg', bytes: 0, state: 'pending' }])), null);
  assert.equal(sourceOf(mic('finalized', [{ kind: 'delivery', codec: 'opus', container: 'ogg', bytes: 0, state: 'sealed' }])), null, 'an empty sealed file is no audio');
  assert.ok(sourceOf(mic('finalized', undefined)), 'no media list (not a detail read): trust the final state');
});

test('a microphone recording with a sealed video says so', () => {
  const job = liveJob(mic('finalized', [...sealedDelivery, { kind: 'video', codec: 'h264', container: 'mp4', bytes: 1, state: 'sealed' }])) as unknown as Record<string, unknown>;
  assert.equal(job.hasVideo, true);
});

test('a stream link keeps its link job: audio only once final, video only over RTMP', () => {
  const tx = (state: string, url: string) => ({ id: 'tx-2', live: true, state, source: { kind: 'stream', url }, ingest: { url }, media: [...sealedDelivery, { kind: 'video', codec: 'h264', container: 'mp4', bytes: 1, state: 'sealed' }], job: null }) as never;
  const radio = sourceOf(tx('finalized', 'https://radio.example/live.mp3')) as unknown as Record<string, any>;
  assert.deepEqual(radio.source, { kind: 'url', url: 'https://radio.example/live.mp3' });
  assert.equal(radio.hasAudio, true);
  assert.equal(radio.hasVideo, false, 'a link\'s video is never ours');
  const going = sourceOf(tx('live', 'https://radio.example/live.mp3')) as unknown as Record<string, any>;
  assert.equal(going.hasAudio, false);
  assert.equal(going.state, 'transcribing');
  const rtmp = sourceOf(tx('finalized', 'rtmp://ingest.example/live/key')) as unknown as Record<string, any>;
  assert.equal(rtmp.hasVideo, true);
});

test('a share link\'s live transcription finds its stream link in source as the owner\'s does', () => {
  const job = liveJob({ id: 'tx-3', live: true, state: 'finalized', source: { kind: 'stream', url: 'https://radio.example/a.mp3' }, ingest: null, media: [] } as never) as unknown as Record<string, any>;
  assert.equal(job.source.url, 'https://radio.example/a.mp3');
});

test('a file or link transcription keeps its own job', () => {
  const own = { transcriptionId: 'tx-4', state: 'done', hasAudio: true };
  assert.equal(sourceOf({ id: 'tx-4', live: false, state: 'finalized', job: own } as never), own as never);
  assert.equal(sourceOf({ id: 'tx-5', live: false, state: 'finalized', job: null } as never), null);
});
