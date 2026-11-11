import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClockMedia, mediaKey } from '../src/core/clockMedia.ts';

type H = (() => void) | null;

class FakeEl {
  preload = '';
  currentTime = 0;
  readyState = 0;
  paused = true;
  ended = false;
  plays = 0;
  onplay: H = null; onpause: H = null; onended: H = null; onwaiting: H = null; onstalled: H = null;
  onplaying: H = null; oncanplay: H = null; onloadedmetadata: H = null; onerror: H = null;
  src: string;
  constructor(src: string) { this.src = src; }
  play(): Promise<void> { this.plays += 1; if (this.paused) { this.paused = false; this.onplay?.(); } return Promise.resolve(); }
  pause(): void { if (!this.paused) { this.paused = true; const h = this.onpause; queueMicrotask(() => h?.()); } }
  loaded(): void { this.readyState = 1; this.onloadedmetadata?.(); }
}

function rig(offset = 0) {
  const made: FakeEl[] = [];
  const ats: number[] = [];
  const plays: boolean[] = [];
  const ctl = new ClockMedia<FakeEl>({
    make: (u) => { const e = new FakeEl(u); made.push(e); return e; },
    offset: () => offset,
    playing: (on) => plays.push(on),
    buffering: () => {},
    ready: () => {},
    at: (t) => ats.push(t),
    playError: () => {},
    failed: () => {},
  });
  return { ctl, made, ats, plays };
}

const audio = (tok: string, kind = 'delivery') => `https://api.vocalstack.com/v1/recordings/01a1ba52/audio?kind=${kind}&format=ogg&access_token=${tok}`;
const tick = () => new Promise((r) => setTimeout(r, 0));

test('the media key drops only the credentials, so a refreshed sign-in token names the same audio', () => {
  assert.equal(mediaKey(audio('A')), mediaKey(audio('B')));
  assert.notEqual(mediaKey(audio('A')), mediaKey(audio('A', 'source')));
  assert.equal(mediaKey('https://x/v1/recordings/r/audio?kind=voice&lang=fr&media=m1&listenerToken=l1'), 'https://x/v1/recordings/r/audio?kind=voice&lang=fr');
  assert.equal(mediaKey(null), null);
  assert.equal(mediaKey('https://example.com/a.mp3'), 'https://example.com/a.mp3');
});

test('a refreshed sign-in token keeps the element, its position and its playback', async () => {
  const { ctl, made, plays } = rig();
  ctl.use(audio('A'));
  made[0].loaded();
  ctl.seek(61.5);
  await ctl.play();
  plays.length = 0;
  assert.equal(ctl.use(audio('B')), false, 'a token-only change does not rebuild');
  await tick();
  assert.equal(made.length, 1);
  assert.equal(ctl.el, made[0]);
  assert.equal(made[0].paused, false);
  assert.equal(ctl.position(), 61.5);
  assert.deepEqual(plays, [], 'the playing state never flips');
  assert.equal(ctl.latest, audio('B'), 'the new token is kept for the next load');
  assert.equal(ctl.loadedFrom, audio('A'));
  ctl.reload();
  assert.equal(made[1].src, audio('B'), 'the next load uses the new token');
});

test('a seek during a reload lands where it was asked, and playback resumes there', async () => {
  const { ctl, made, plays } = rig(2);
  ctl.use(audio('A'));
  made[0].loaded();
  ctl.seek(10);
  await ctl.play();
  ctl.use(audio('A', 'source'));
  assert.equal(made.length, 2);
  ctl.seek(61.5);
  made[1].loaded();
  assert.equal(made[1].currentTime, 63.5, 'the click wins over the position carried from the old element');
  assert.equal(made[1].paused, false);
  assert.equal(plays.includes(false), false, 'playing survives the swap');
  await tick();
  assert.equal(ctl.position(), 61.5);
});

test('without a click, the new element resumes where the old one was', async () => {
  const { ctl, made } = rig();
  ctl.use(audio('A'));
  made[0].loaded();
  made[0].currentTime = 33;
  await ctl.play();
  ctl.use(audio('A', 'source'));
  made[1].loaded();
  assert.equal(made[1].currentTime, 33);
  assert.equal(made[1].paused, false);
});

test('the clock never reports 0 from an element that has not loaded', async () => {
  const { ctl, made, ats } = rig();
  ctl.use(audio('A'));
  made[0].loaded();
  ctl.seek(61.5);
  await ctl.play();
  ats.length = 0;
  ctl.use(audio('A', 'source'));
  assert.equal(made[1].readyState, 0);
  assert.equal(ctl.position(), null, 'an unloaded element has no position to report');
  assert.deepEqual(ats, [61.5], 'the clock is told the carried position, never 0');
  await tick();
  assert.equal(ctl.position(), null);
  made[1].loaded();
  assert.equal(ctl.position(), 61.5);
});

test('pause and play during a reload change what happens once it loads', async () => {
  const { ctl, made, plays } = rig();
  ctl.use(audio('A'));
  made[0].loaded();
  await ctl.play();
  ctl.use(audio('A', 'source'));
  ctl.pause();
  assert.equal(plays.at(-1), false);
  made[1].loaded();
  assert.equal(made[1].paused, true);
  ctl.use(audio('A', 'delivery'));
  await ctl.play();
  assert.equal(plays.at(-1), true);
  made[2].loaded();
  assert.equal(made[2].paused, false);
});

test('an element that fails while playing comes back at its position and plays on', async () => {
  const { ctl, made } = rig();
  ctl.use(audio('A'));
  made[0].loaded();
  made[0].currentTime = 30;
  await ctl.play();
  made[0].onerror?.();
  ctl.forget();
  assert.equal(ctl.el, null);
  ctl.use(audio('B'));
  assert.equal(made.length, 2, 'a forgotten element loads again on the next token');
  assert.equal(made[1].src, audio('B'));
  made[1].loaded();
  assert.equal(made[1].currentTime, 30);
  assert.equal(made[1].paused, false);
});

test('a play asked before there is audio starts once it arrives; a second ask cancels it', async () => {
  const { ctl, made } = rig();
  ctl.use(null);
  ctl.ask(12);
  ctl.use(audio('A'));
  made[0].loaded();
  assert.equal(made[0].currentTime, 12);
  assert.equal(made[0].paused, false);
  ctl.use(null);
  ctl.ask(5);
  ctl.ask(5);
  ctl.use(audio('A'));
  made[1].loaded();
  assert.equal(made[1].paused, true);
});
