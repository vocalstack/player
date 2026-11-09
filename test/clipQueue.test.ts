import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ClipQueue, type VoiceClip } from '../src/core/clipQueue.ts';

const played: string[] = [];
let failNext = 0;

class FakeAudio {
  src = '';
  currentSrc = '';
  paused = true;
  ended = false;
  error: { code: number } | null = null;
  currentTime = 0;
  duration = NaN;
  muted = false;
  volume = 1;
  playbackRate = 1;
  preload = '';
  playsInline = true;
  onplaying: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url?: string) { if (url) this.src = url; }
  addEventListener() {}
  removeAttribute() {}
  load() {}
  pause() { this.paused = true; }
  play() {
    if (failNext > 0) { failNext--; return Promise.reject(new Error('not playable yet')); }
    this.paused = false;
    this.ended = false;
    this.currentSrc = this.src;
    this.currentTime = 0;
    played.push(this.src);
    this.onplaying?.();
    return Promise.resolve();
  }
  finish(s: number) {
    this.duration = s;
    this.currentTime = s;
    this.ended = true;
    this.paused = true;
    this.onended?.();
  }
}

const clip = (id: number): VoiceClip => ({ sentenceId: id, lang: 'ro', src: `c${id}`, durationS: 2, part: 0, parts: 1 });
const el = (q: ClipQueue) => (q as unknown as { el: FakeAudio }).el;
const settle = () => new Promise<void>((r) => setImmediate(r));
const g = globalThis as unknown as { Audio: unknown; fetch: unknown };
const realFetch = g.fetch;

beforeEach(() => {
  played.length = 0;
  failNext = 0;
  g.Audio = FakeAudio;
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
});

afterEach(() => {
  mock.timers.reset();
  g.fetch = realFetch;
});

function queue(gap: (prev: number | null, next: number) => number) {
  const q = new ClipQueue();
  q.finite = true;
  q.gapBefore = gap;
  q.add(clip(1));
  q.add(clip(2));
  return q;
}

test('the next line waits through the silence before it, as long as the video is silent there', () => {
  const q = queue((prev) => (prev == null ? 0 : 2));
  q.play(1);
  assert.deepEqual(played, ['c1']);
  el(q).finish(1.5);
  assert.deepEqual(played, ['c1'], 'line 2 does not start the moment line 1 ends');
  assert.equal(q.resting()?.sentenceId, 1);
  mock.timers.tick(1000);
  assert.ok(Math.abs((q.resting()?.s ?? 0) - 1) < 0.01, 'the silence is counted as it passes');
  mock.timers.tick(999);
  assert.deepEqual(played, ['c1']);
  mock.timers.tick(1);
  assert.deepEqual(played, ['c1', 'c2']);
  assert.equal(q.resting(), null);
});

test('a pause inside a silence holds it, and resuming waits only for what is left of it', () => {
  const q = queue((prev) => (prev == null ? 0 : 2));
  q.play(1);
  el(q).finish(1.5);
  mock.timers.tick(500);
  q.pause();
  mock.timers.tick(10_000);
  assert.deepEqual(played, ['c1'], 'nothing is read while paused');
  assert.equal(q.resume(1), true);
  mock.timers.tick(1499);
  assert.deepEqual(played, ['c1']);
  mock.timers.tick(1);
  assert.deepEqual(played, ['c1', 'c2']);
});

test('a seek inside a silence drops the wait and reads the line it lands on', () => {
  const q = queue((prev) => (prev == null ? 0 : 2));
  q.play(1);
  el(q).finish(1.5);
  q.play(2);
  assert.deepEqual(played, ['c1', 'c2']);
  mock.timers.tick(5000);
  assert.deepEqual(played, ['c1', 'c2'], 'the dropped wait does not start anything later');
});

test('starting before the first line waits for it once, then reads it', () => {
  let asked = 0;
  const q = queue((prev, next) => { if (prev == null && next === 1) asked++; return prev == null && next === 1 ? 3 : 0; });
  q.play(1);
  assert.deepEqual(played, []);
  assert.equal(q.resting()?.sentenceId, 1);
  mock.timers.tick(3000);
  assert.deepEqual(played, ['c1'], 'the first line starts when its moment comes, not after another wait');
  assert.equal(asked, 1);
});

test('a line that finished being made while it was retried is read, not dropped', async () => {
  g.fetch = async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => null });
  const q = queue(() => 0);
  failNext = 1;
  q.play(1);
  await settle();
  await settle();
  assert.deepEqual(played, ['c1']);
  assert.equal(q.has(1), true);
  assert.equal(q.current, 1);
});

test('a line still being made is waited for, not dropped', async () => {
  g.fetch = async () => ({ ok: false, status: 503, headers: new Headers(), json: async () => ({ code: 'engine_unavailable', retryable: true }) });
  const q = queue(() => 0);
  let starting: number | null = null;
  q.onStarting = (since) => { starting = since; };
  failNext = 1;
  q.play(1);
  await settle();
  await settle();
  assert.deepEqual(played, []);
  assert.notEqual(starting, null, 'the page says the voice is starting');
  assert.equal(q.has(1), true);
  mock.timers.tick(3000);
  assert.deepEqual(played, ['c1']);
});

function fetchedClips() {
  const asked: string[] = [];
  g.fetch = async (src: string) => {
    asked.push(src);
    return { ok: true, status: 200, headers: new Headers(), blob: async () => new Blob([`audio ${src}`]), json: async () => null };
  };
  return asked;
}

test('the lines ahead are loaded while one plays, and the next line plays from memory without a network wait', async () => {
  const asked = fetchedClips();
  const q = new ClipQueue();
  q.readAhead = 3;
  for (let i = 1; i <= 8; i++) q.add(clip(i));
  q.play(1);
  await settle();
  await settle();
  assert.deepEqual(asked.slice(0, 3), ['c2', 'c3', 'c4'], 'nearest first');
  assert.ok(!asked.includes('c1'), 'the line playing is not fetched twice');
  assert.ok(!asked.includes('c8'), 'nor lines far ahead');
  el(q).finish(2);
  assert.match(played[1], /^blob:/, 'line 2 starts from memory');
  assert.equal(q.readingAt(), 2);
});

test('the window reaches far enough to cover the seconds asked for, not just a count of lines', async () => {
  const asked = fetchedClips();
  const q = new ClipQueue();
  q.readAhead = 2;
  q.readAheadS = 9;
  for (let i = 1; i <= 10; i++) q.add(clip(i));
  q.play(1);
  for (let i = 0; i < 6; i++) await settle();
  assert.ok(['c2', 'c3', 'c4', 'c5', 'c6'].every((s) => asked.includes(s)), `five 2 s lines cover 9 s: ${asked}`);
  assert.ok(!asked.includes('c7'));
});

test('a seek while paused loads the new place before play is pressed', async () => {
  const asked = fetchedClips();
  const q = new ClipQueue();
  q.readAhead = 2;
  for (let i = 1; i <= 40; i++) q.add(clip(i));
  q.seek(30);
  await settle();
  assert.deepEqual(asked.slice(0, 2), ['c30', 'c31']);
  q.play(30);
  assert.match(played[0], /^blob:/, 'the first line after the seek is already in memory');
});

test('a clip that will not play from memory is fetched again and retried from its address', async () => {
  fetchedClips();
  const q = new ClipQueue();
  q.readAhead = 2;
  for (let i = 1; i <= 3; i++) q.add(clip(i));
  q.play(1);
  await settle();
  await settle();
  assert.ok(q.prefetch.ready('c2'));
  failNext = 1;
  el(q).finish(2);
  await settle();
  assert.ok(!q.prefetch.ready('c2'), 'the bad copy is dropped');
});

test('a line the server is still making is waited for, not skipped after the usual wait', () => {
  const q = new ClipQueue();
  q.finite = true;
  q.add(clip(1));
  q.add(clip(3));
  q.setSequence([1, 2, 3]);
  q.coming = (id) => id === 2;
  q.play(1);
  el(q).finish(2);
  mock.timers.tick(60_000);
  assert.deepEqual(played, ['c1'], 'line 2 is still awaited a minute on');
  q.add(clip(2));
  assert.deepEqual(played, ['c1', 'c2'], 'and read the moment it arrives');
});

test('a line that is not coming is skipped after the usual wait', () => {
  const q = new ClipQueue();
  q.finite = true;
  q.add(clip(1));
  q.add(clip(3));
  q.setSequence([1, 2, 3]);
  q.play(1);
  el(q).finish(2);
  mock.timers.tick(16_000);
  assert.deepEqual(played, ['c1', 'c3']);
});

test('a line still being made is waited for even when no later line is loaded yet: playback does not just stop', () => {
  const q = new ClipQueue();
  const waited: (number | null)[] = [];
  q.onWaiting = (id) => waited.push(id);
  q.add(clip(1));
  q.setSequence([1, 2, 3]);
  q.coming = (id) => id === 2 || id === 3;
  q.play(1);
  el(q).finish(2);
  assert.ok(waited.includes(2), `waiting on line 2, shown as loading: ${waited}`);
  assert.equal(q.readingAt(), 2);
  mock.timers.tick(30_000);
  q.add(clip(2));
  assert.deepEqual(played, ['c1', 'c2'], 'and line 2 plays the moment it is made');
});

function flowQueue(held: number[], lines = [1, 2, 3, 4]) {
  const q = new ClipQueue();
  q.finite = true;
  q.flow = true;
  q.gapBefore = () => 0;
  q.silentSpan = () => ({ fromS: 0, ms: 3000 });
  q.setSequence(lines);
  for (const id of held) q.add(clip(id));
  return q;
}

test('with a video to follow, a line with no voice yet passes in silence for its length and the next voiced line is read', () => {
  const q = flowQueue([1, 3]);
  q.play(1);
  el(q).finish(2);
  assert.deepEqual(q.resting(), { sentenceId: 2, s: 0, silent: true }, 'line 2 is a silent line, not a wait');
  assert.equal(q.playing, true);
  mock.timers.tick(1500);
  assert.ok(Math.abs((q.resting()?.s ?? 0) - 1.5) < 0.01, 'the clock runs through the silent line');
  mock.timers.tick(1500);
  assert.deepEqual(played, ['c1', 'c3']);
});

test('a run of lines with no voice keeps playing instead of stopping', () => {
  const q = flowQueue([1]);
  q.play(1);
  el(q).finish(2);
  for (const id of [2, 3, 4]) {
    assert.equal(q.resting()?.sentenceId, id);
    assert.equal(q.playing, true);
    mock.timers.tick(3000);
  }
  assert.deepEqual(played, ['c1']);
});

test('a voice that arrives for a line already passed in silence is not read late; a later one is read on time', () => {
  const q = flowQueue([1]);
  q.play(1);
  el(q).finish(2);
  mock.timers.tick(1000);
  q.add(clip(2));
  q.add(clip(3));
  assert.deepEqual(played, ['c1'], 'line 2 is half over: it stays silent');
  mock.timers.tick(2000);
  assert.deepEqual(played, ['c1', 'c3']);
});

test('pausing inside a silent line holds its clock and resuming continues it', () => {
  const q = flowQueue([1, 3]);
  q.play(1);
  el(q).finish(2);
  mock.timers.tick(1000);
  q.pause();
  mock.timers.tick(10_000);
  assert.ok(Math.abs((q.resting()?.s ?? 0) - 1) < 0.01);
  assert.equal(q.resume(2), true);
  mock.timers.tick(1999);
  assert.deepEqual(played, ['c1']);
  mock.timers.tick(1);
  assert.deepEqual(played, ['c1', 'c3']);
});

test('starting on a line with no voice plays on in silence at once, without holding the video', () => {
  const q = flowQueue([3]);
  q.play(2);
  assert.equal(q.resting()?.sentenceId, 2);
  assert.equal(q.resting()?.silent, true);
  mock.timers.tick(3000);
  assert.deepEqual(played, ['c3']);
});

test('joining a line mid-speech (a language switch) stays silent through it, never restarts it, and reads the next line in step', () => {
  const q = flowQueue([2, 3]);
  q.silentSpan = () => ({ fromS: 2.5, ms: 500 });
  q.joinSilently(2);
  assert.equal(q.playing, true);
  assert.deepEqual(q.resting(), { sentenceId: 2, s: 2.5, silent: true }, 'the clock starts where the video is, not at the line start');
  assert.deepEqual(played, [], 'the line already under way is not read from its start');
  mock.timers.tick(500);
  assert.deepEqual(played, ['c3']);
});

function readingQueue(held: number[], original: number[]) {
  const q = new ClipQueue();
  q.finite = true;
  q.gapBefore = () => 0;
  q.silentSpan = (_id, frac) => ({ fromS: (frac ?? 0) * 4, ms: (1 - (frac ?? 0)) * 4000 });
  q.setOriginal(original);
  for (const id of held) q.add(clip(id));
  return q;
}

test('a reading in the language a line was spoken in plays that line in its original audio, between the voiced lines, in order', () => {
  const q = readingQueue([1, 3], [2]);
  q.play(1);
  assert.deepEqual(played, ['c1']);
  el(q).finish(2);
  assert.deepEqual(q.resting(), { sentenceId: 2, s: 0, silent: true, original: true }, 'line 2 is its original audio, not skipped');
  assert.equal(q.playing, true);
  mock.timers.tick(3999);
  assert.deepEqual(played, ['c1'], 'line 3 waits for the original line to end');
  mock.timers.tick(1);
  assert.deepEqual(played, ['c1', 'c3']);
  el(q).finish(2);
  assert.equal(q.playing, false, 'the reading ends after the last line');
});

test('pausing on an original line holds it; resuming continues it, then the next voiced line plays', () => {
  const q = readingQueue([1, 3], [2]);
  q.play(1);
  el(q).finish(2);
  mock.timers.tick(1000);
  q.pause();
  mock.timers.tick(30_000);
  assert.ok(Math.abs((q.resting()?.s ?? 0) - 1) < 0.01);
  assert.equal(q.resume(2), true);
  mock.timers.tick(3000);
  assert.deepEqual(played, ['c1', 'c3']);
});

test('a seek into an original line starts there, from the point sought', () => {
  const q = readingQueue([1, 3], [2]);
  q.play(1);
  q.startWithin(2, 0.5);
  q.seek(2);
  assert.deepEqual(q.resting(), { sentenceId: 2, s: 2, silent: true, original: true });
  mock.timers.tick(2000);
  assert.deepEqual(played, ['c1', 'c3']);
});

test('original lines after the last voiced one still play, and a reading of only original lines plays through', () => {
  const q = readingQueue([1], [2, 3]);
  q.play(1);
  el(q).finish(2);
  assert.equal(q.resting()?.sentenceId, 2);
  mock.timers.tick(4000);
  assert.equal(q.resting()?.sentenceId, 3);
  mock.timers.tick(4000);
  assert.equal(q.playing, false);
  const only = readingQueue([], [5, 6]);
  only.play(6);
  assert.equal(only.resting()?.sentenceId, 6, 'starting on an original line beyond every clip starts there');
  assert.equal(only.resting()?.original, true);
});

test('with a video to follow, an original line is marked so the video sound can play under it', () => {
  const q = flowQueue([1, 3]);
  q.setOriginal([2]);
  q.play(1);
  el(q).finish(2);
  assert.deepEqual(q.resting(), { sentenceId: 2, s: 0, silent: true, original: true });
});
