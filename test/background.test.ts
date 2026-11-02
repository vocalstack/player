import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bedNote, bedRetryS, followBed, partAt, partsOf, removeBgFromQuery, removeBgOf, slotsFor, trackPlan, withRemoveBg, type BedMedia, type SepPart } from '../src/core/background.ts';

function media(t = 0, paused = true): BedMedia & { plays: number; pauses: number } {
  const m = {
    currentTime: t, paused, muted: false, plays: 0, pauses: 0,
    play() { m.plays++; m.paused = false; return Promise.resolve(); },
    pause() { m.pauses++; m.paused = true; },
  };
  return m;
}

test('the background follows the spoken track and only seeks when it has drifted', () => {
  const a = media(10.1, true);
  followBed(a, { t: 10, playing: true, muted: false });
  assert.equal(a.currentTime, 10.1);
  assert.equal(a.plays, 1);
  followBed(a, { t: 42, playing: true, muted: false });
  assert.equal(a.currentTime, 42);
  assert.equal(a.plays, 1);
});

test('the background pauses with the voice and keeps its mute in step', () => {
  const a = media(5, false);
  followBed(a, { t: 5, playing: false, muted: true });
  assert.equal(a.pauses, 1);
  assert.equal(a.muted, true);
  followBed(a, { t: 5, playing: false, muted: true });
  assert.equal(a.pauses, 1);
});

test('a background still being made is asked again; anything else is final', () => {
  assert.equal(bedRetryS(503, { data: { details: { retryAfterS: 2 } } }), 2);
  assert.equal(bedRetryS(503, null), 3);
  assert.equal(bedRetryS(404, { message: 'no audio' }), null);
});

test('the setting row says when a track is being prepared or cannot be had', () => {
  const note = "Takes out everything that isn't speech: music, ambience and noise.";
  assert.equal(bedNote(true, 'making'), 'Separating the speech from the background…');
  assert.equal(bedNote(false, 'making'), 'Separating the speech from the background…');
  assert.equal(bedNote(true, 'ready'), note);
  assert.equal(bedNote(false, 'off'), note);
  assert.equal(bedNote(true, 'unavailable'), 'Not available for this transcription');
  assert.equal(bedNote(false, 'unavailable', 'video'), 'Not available for this video');
  assert.equal(bedNote(true, 'making', 'transcription', 95.4), 'Separating the speech from the background… ready up to 1:35');
});

test('removing the background drops the bed under a voice and swaps the original for its speech', () => {
  assert.deepEqual(trackPlan(false, true), { bed: true, speech: false });
  assert.deepEqual(trackPlan(true, true), { bed: false, speech: false });
  assert.deepEqual(trackPlan(false, false), { bed: false, speech: false });
  assert.deepEqual(trackPlan(true, false), { bed: false, speech: true });
});

test('the old keep-background choice carries over as its inverse', () => {
  assert.equal(removeBgOf(null, null), false);
  assert.equal(removeBgOf(null, true), false);
  assert.equal(removeBgOf(null, false), true);
  assert.equal(removeBgOf(false, false), false);
  assert.equal(removeBgOf(true, true), true);
});

test('the link keeps bg=off working and writes bg=remove', () => {
  assert.equal(removeBgFromQuery(new URLSearchParams('bg=off')), true);
  assert.equal(removeBgFromQuery(new URLSearchParams('bg=remove')), true);
  assert.equal(removeBgFromQuery(new URLSearchParams('')), false);
  const u = new URL('https://x.test/v/abc?bg=off&lang=fr');
  withRemoveBg(u, false);
  assert.equal(u.search, '?lang=fr');
  withRemoveBg(u, true);
  assert.equal(u.searchParams.get('bg'), 'remove');
});

const parts: SepPart[] = [
  { startS: 0, endS: 30, url: 'u1' },
  { startS: 30, endS: 60, url: 'u2' },
  { startS: 60, endS: 75.5, url: 'u3' },
];

test('the parts ready so far are read from the 503 and stop at the first gap or bad entry', () => {
  const body = (p: unknown) => ({ code: 'engine_unavailable', data: { details: { retryAfterS: 10, readyUntilS: 75.5, parts: p } } });
  assert.deepEqual(partsOf(body(parts)), { untilS: 75.5, parts });
  assert.deepEqual(partsOf(body([parts[0], parts[2]])), { untilS: 30, parts: [parts[0]] });
  assert.deepEqual(partsOf(body([parts[1]])), { untilS: 0, parts: [] });
  assert.deepEqual(partsOf(body([parts[0], { startS: 30, endS: 30, url: 'x' }])), { untilS: 30, parts: [parts[0]] });
  assert.deepEqual(partsOf(null), { untilS: 0, parts: [] });
  assert.deepEqual(partsOf({ data: { details: { retryAfterS: 30 } } }), { untilS: 0, parts: [] });
});

test('the separated track plays where a part covers the moment and the plain audio beyond it', () => {
  assert.equal(partAt(parts, 0), 0);
  assert.equal(partAt(parts, 29.99), 0);
  assert.equal(partAt(parts, 30), 1);
  assert.equal(partAt(parts, 61), 2);
  assert.equal(partAt(parts, 75.46), -1);
  assert.equal(partAt(parts, 80), -1);
  assert.equal(partAt(parts, -1), -1);
  assert.equal(partAt([], 0), -1);
});

test('the next part is loaded beside the playing one so the hand-over at its start needs no fetch', () => {
  let held: [number, number] = [NaN, NaN];
  let plan = slotsFor(parts, 0, held, 0);
  assert.deepEqual(plan, { play: 0, load: [[0, 0], [1, 1]] });
  held = [0, 30];
  plan = slotsFor(parts, 0, held, 0);
  assert.deepEqual(plan, { play: 0, load: [] });
  plan = slotsFor(parts, 1, held, 0);
  assert.deepEqual(plan, { play: 1, load: [[0, 2]] });
  held = [60, 30];
  plan = slotsFor(parts, 2, held, 1);
  assert.deepEqual(plan, { play: 0, load: [] });
  plan = slotsFor(parts, 0, [60, 30], 0);
  assert.deepEqual(plan, { play: 0, load: [[0, 0]] }, 'a seek back reloads the playing slot and keeps the next part');
});
