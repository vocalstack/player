import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followTarget, mayRunOn, playbackClock, readingClock, upcomingSrcs, type FollowClip, type FollowLine } from '../src/core/voiceFollow.ts';

const lines: FollowLine[] = [
  { sid: 0, start: 10, end: 14 },
  { sid: 1, start: 14, end: 20 },
  { sid: 2, start: 25, end: 30 },
];
const clip = (src: string, part = 0, parts = 1, durationS = 3): FollowClip => ({ src, part, parts, durationS });
const map = (e: [number, FollowClip[]][]) => new Map(e);

test('the voice heard is the clip of the line under the video, from where the video is in it', () => {
  const c = map([[0, [clip('a')]], [1, [clip('b')]]]);
  assert.deepEqual(followTarget(lines, c, 11.5), { kind: 'play', sid: 0, src: 'a', offset: 1.5 });
  assert.deepEqual(followTarget(lines, c, 14), { kind: 'play', sid: 1, src: 'b', offset: 0 });
});

test('a line whose voice is not ready yet is silent and says so; when it arrives it comes in at the video time', () => {
  assert.deepEqual(followTarget(lines, map([]), 16), { kind: 'missing', sid: 1 });
  assert.deepEqual(followTarget(lines, map([[1, [clip('b', 0, 1, 5)]]]), 16), { kind: 'play', sid: 1, src: 'b', offset: 2 });
});

test('a long line read in parts plays the part the video has reached', () => {
  const c = map([[1, [clip('b0', 0, 2, 2), clip('b1', 1, 2, 3)]]]);
  assert.deepEqual(followTarget(lines, c, 15), { kind: 'play', sid: 1, src: 'b0', offset: 1 });
  assert.deepEqual(followTarget(lines, c, 16.5), { kind: 'play', sid: 1, src: 'b1', offset: 0.5 });
  assert.deepEqual(followTarget(lines, map([[1, [clip('b0', 0, 2, 2)]]]), 16.5), { kind: 'missing', sid: 1 });
});

test('after a line has been spoken, and between lines, nothing plays', () => {
  const c = map([[1, [clip('b', 0, 1, 2)]]]);
  assert.deepEqual(followTarget(lines, c, 17), { kind: 'done', sid: 1 });
  assert.deepEqual(followTarget(lines, c, 22), { kind: 'none' });
  assert.deepEqual(followTarget(lines, c, 5), { kind: 'none' });
});

test('the clips of the line playing and the next ones are loaded ahead', () => {
  const c = map([[0, [clip('a')]], [1, [clip('b')]], [2, [clip('c')]]]);
  assert.deepEqual(upcomingSrcs(lines, c, 11, 1), ['a', 'b']);
  assert.deepEqual(upcomingSrcs(lines, c, 26), ['c']);
});

test('after a jump the voice of the line before stops; only the line that just ended may run on', async () => {
  const { mayRunOn } = await import('../src/core/voiceFollow.ts');
  const lines = [{ sid: 1, start: 10, end: 14 }, { sid: 2, start: 20, end: 25 }, { sid: 3, start: 30, end: 33 }];
  assert.equal(mayRunOn(lines, 15, 1), true);
  assert.equal(mayRunOn(lines, 15, 3), false);
  assert.equal(mayRunOn(lines, 26, 1), false);
  assert.equal(mayRunOn(lines, 20.5, 1), true);
  assert.equal(mayRunOn(lines, 22, 1), false);
  assert.equal(mayRunOn(lines, 5, 2), false);
  assert.equal(mayRunOn(lines, 15, null), false);
});

test('a click on a word inside a line starts the voice at that word: from its own word times when the track has them, else by how much of the line is before it', () => {
  const ws = [{ start: 14, end: 15, text: 'one' }, { start: 15, end: 16, text: 'two' }, { start: 16, end: 18, text: 'threefour' }];
  const ln: FollowLine[] = [{ sid: 1, start: 14, end: 20, words: ws }];
  const c = map([[1, [clip('b', 0, 1, 6)]]]);
  assert.deepEqual(followTarget(ln, c, 16, { 1: [[0, 0.5], [0.5, 2], [2, 5]] }), { kind: 'play', sid: 1, src: 'b', offset: 2 });
  assert.deepEqual(followTarget(ln, c, 15.5, { 1: [[0, 0.5], [0.5, 2], [2, 5]] }), { kind: 'play', sid: 1, src: 'b', offset: 1.25 });
  const share = followTarget(ln, c, 16);
  assert.equal(share.kind === 'play' ? Math.round(share.offset * 1000) / 1000 : null, 2.4);
  assert.deepEqual(followTarget(ln, c, 14), { kind: 'play', sid: 1, src: 'b', offset: 0 });
});

test('word times that do not match the line, or a line read in parts, fall back to the share of the line', () => {
  const ws = [{ start: 14, end: 15, text: 'aa' }, { start: 15, end: 16, text: 'bb' }];
  const ln: FollowLine[] = [{ sid: 1, start: 14, end: 20, words: ws }];
  assert.deepEqual(followTarget(ln, map([[1, [clip('b', 0, 1, 4)]]]), 15, { 1: [[0, 1]] }), { kind: 'play', sid: 1, src: 'b', offset: 2 });
  assert.deepEqual(followTarget(ln, map([[1, [clip('b0', 0, 2, 2), clip('b1', 1, 2, 2)]]]), 15.5), { kind: 'play', sid: 1, src: 'b1', offset: 1 });
});

test('under a line spoken in the language picked, the video is heard: no clip, nothing missing', () => {
  const c = map([[0, [clip('a')]]]);
  assert.deepEqual(followTarget(lines, c, 15, undefined, new Set([1])), { kind: 'original', sid: 1 });
  assert.deepEqual(followTarget(lines, c, 11, undefined, new Set([1])), { kind: 'play', sid: 0, src: 'a', offset: 1 }, 'the other lines keep their voice');
  assert.deepEqual(followTarget(lines, map([]), 26, undefined, new Set([0, 1, 2])), { kind: 'original', sid: 2 }, 'an all-original reading is never missing');
});

function playThrough(ls: FollowLine[], clips: Map<number, FollowClip[]>, original: Set<number>, lenS: number) {
  const step = 0.05;
  const heard: { t: number; what: string }[] = [];
  let cur: { sid: number; src: string; until: number } | null = null;
  let t = 0;
  for (let k = 0; k * step <= lenS + 1e-9; k++) {
    t = Math.round(k * step * 100) / 100;
    const want = followTarget(ls, clips, t, undefined, original);
    if (cur && t >= cur.until) cur = null;
    if (want.kind === 'play') {
      if (!cur || cur.src !== want.src) { cur = { sid: want.sid, src: want.src, until: t - want.offset + (clips.get(want.sid)![0].durationS ?? 0) }; heard.push({ t, what: `${want.src}@${want.offset.toFixed(2)}` }); }
    } else if (cur && !mayRunOn(ls, t, cur.sid)) cur = null;
    const what = cur ? cur.src : want.kind === 'original' ? 'original' : 'quiet';
    if (!heard.length || heard[heard.length - 1].what.split('@')[0] !== what) heard.push({ t, what });
  }
  return { heard, endT: t };
}

test('an audio-only mixed recording plays on the recording clock: exactly its length, each clip at its sentence start, original audio for the lines in the picked language', () => {
  assert.equal(playbackClock(false, true), 'audio', 'audio-only playback follows the recording audio as video playback follows the video');
  assert.equal(playbackClock(true, false), 'video');
  assert.equal(playbackClock(false, false), 'clips', 'only with no audio at all are clips read back to back');
  const ls: FollowLine[] = [
    { sid: 1, start: 0.5, end: 3 },
    { sid: 2, start: 3, end: 6 },
    { sid: 3, start: 6, end: 8.5 },
  ];
  const c = map([[1, [clip('fr1', 0, 1, 3.2)]], [3, [clip('fr3', 0, 1, 1.5)]]]);
  const { heard, endT } = playThrough(ls, c, new Set([2]), 10);
  assert.equal(endT, 10, 'the playthrough lasts the recording length, never the sum of the clips');
  assert.deepEqual(heard.map((h) => [h.t, h.what]), [
    [0, 'quiet'],
    [0.5, 'fr1@0.00'],
    [3.7, 'original'],
    [6, 'fr3@0.00'],
    [7.5, 'quiet'],
  ], 'clip 1 starts at its line and runs on 0.7 s into the original line (under 1.5 s); clip 3 starts at 6 s; silence to the end');
});

test('a reading on a screen with no video (the Dashboard) keeps the recording clock; only live listening and a recording with no audio read back to back', () => {
  assert.equal(readingClock({ timed: false, ended: true, audio: 'https://api/v1/recordings/r/audio?kind=delivery' }), 'audio', 'an ended recording with its audio: clips at their starts on the recording timeline');
  assert.equal(readingClock({ timed: false, ended: false, audio: 'https://api/v1/recordings/r/audio?kind=delivery' }), 'clips', 'live listening reads as the lines arrive');
  assert.equal(readingClock({ timed: false, ended: true, audio: null }), 'clips', 'no audio at all: back to back');
  assert.equal(readingClock({ timed: true, ended: true, audio: 'x' }), 'video', 'a video (or the host page) owns the clock');
});

test('on the recording clock, a seek lands in a clip at the matching point, an original line or a gap, as the download has them', () => {
  const ls: FollowLine[] = [{ sid: 1, start: 1, end: 4 }, { sid: 2, start: 4, end: 7 }, { sid: 3, start: 7, end: 9 }];
  const c = map([[1, [clip('a', 0, 1, 2)]], [3, [clip('c', 0, 1, 2)]]]);
  const orig = new Set([2]);
  const at = followTarget(ls, c, 7.5, undefined, orig);
  assert.deepEqual(at, { kind: 'play', sid: 3, src: 'c', offset: 0.5 }, 'seeking to 7.5 s plays clip 3 from 0.5 s in');
  assert.deepEqual(followTarget(ls, c, 5, undefined, orig), { kind: 'original', sid: 2 });
  assert.deepEqual(followTarget(ls, c, 3.5, undefined, orig), { kind: 'done', sid: 1 }, 'after a short clip, the rest of its line is the gap (bed or silence)');
  assert.equal(mayRunOn(ls, 4.5, 1), true, 'a clip still speaking runs on into the original line');
  assert.equal(mayRunOn(ls, 5.6, 1), false, 'but no more than 1.5 s');
});

const answer = (status: number) => ({ ready: status >= 200 && status < 300, again: status === 202 || status === 503 || status === 429, afterMs: status === 503 ? 1000 : null });
const settleAll = () => new Promise<void>((r) => setImmediate(r));

test('on the recording clock a voice clip answering 503 is a voice starting: it says so, re-asks after Retry-After until the clip arrives, then lets it play', async (t) => {
  const { FollowRetry } = await import('../src/core/voiceFollow.ts');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let status = 503;
  let asked = 0;
  const reloaded: string[] = [];
  let changes = 0;
  const r = new FollowRetry(() => { changes += 1; }, (src) => reloaded.push(src), async () => { asked += 1; return answer(status); });
  r.wanted = 'v0';
  await r.errored('v0');
  assert.notEqual(r.startingAt('v0'), null, 'the page says the voice is starting');
  assert.equal(r.busy('v0'), true, 'the clip is held, not played or dropped');
  assert.equal(r.gone('v0'), false);
  assert.ok(changes > 0);
  const since = r.startingAt('v0');
  t.mock.timers.tick(1000);
  await settleAll();
  assert.equal(asked, 2, 're-asked after Retry-After');
  assert.equal(r.startingAt('v0'), since, 'still starting, from the same moment');
  status = 200;
  t.mock.timers.tick(1000);
  await settleAll();
  assert.equal(asked, 3);
  assert.equal(r.startingAt('v0'), null, 'no longer starting once the clip is there');
  assert.equal(r.busy('v0'), false, 'the clip may play');
  assert.deepEqual(reloaded, ['v0'], 'the failed copy is replaced by a fresh one');
  r.dispose();
});

test('a voice that never starts gives up after five minutes and says so; playing again tries afresh', async (t) => {
  const { FollowRetry } = await import('../src/core/voiceFollow.ts');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const r = new FollowRetry(() => {}, () => {}, async () => answer(503));
  r.wanted = 'v0';
  await r.errored('v0');
  for (let i = 0; i < 301 && !r.failed; i++) { t.mock.timers.tick(1000); await settleAll(); }
  assert.equal(r.failed, true, 'the voice did not start in time');
  assert.equal(r.startingAt('v0'), null);
  r.resume();
  assert.equal(r.failed, false);
  r.dispose();
});

test('a starting voice the reader has moved away from stops being asked for; a clip that is not there is dropped', async (t) => {
  const { FollowRetry } = await import('../src/core/voiceFollow.ts');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let asked = 0;
  const r = new FollowRetry(() => {}, () => {}, async (src) => { asked += 1; return answer(src === 'gone' ? 404 : 503); });
  r.wanted = 'v0';
  await r.errored('v0');
  r.wanted = 'v5';
  t.mock.timers.tick(1000);
  await settleAll();
  assert.equal(asked, 1, 'not re-asked once another line is wanted');
  assert.equal(r.startingAt('v0'), null, 'the starting card goes with it');
  await r.errored('gone');
  assert.equal(r.gone('gone'), true, 'a 404 clip is treated as missing');
  r.dispose();
});

test('the clips clock and the recording clock read a clip answer the same way', async () => {
  const { clipStep, CLIP_STARTING_MS, CLIP_RETRY_MS } = await import('../src/core/voiceRetry.ts');
  assert.deepEqual(clipStep(answer(200), null, 0, 5), { kind: 'ready' });
  assert.deepEqual(clipStep(answer(404), null, 0, 5), { kind: 'drop' });
  assert.deepEqual(clipStep(answer(503), null, 0, 5), { kind: 'starting', since: 5, ms: 1000 });
  assert.deepEqual(clipStep(answer(503), 5, 0, 5 + CLIP_STARTING_MS), { kind: 'gaveUp' });
  assert.deepEqual(clipStep(answer(429), null, 1, 5), { kind: 'retry', ms: CLIP_RETRY_MS * 2 });
});
