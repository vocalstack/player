import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClipPrefetch, type Fetcher } from '../src/core/clipPrefetch.ts';

type Call = { src: string; signal: AbortSignal; resolve: (status: number) => void; reject: (e: unknown) => void };

function harness(o: { concurrency?: number; keep?: number; retryMs?: number } = {}) {
  const calls: Call[] = [];
  const revoked: string[] = [];
  let clock = 0;
  const fetcher: Fetcher = (src, signal) =>
    new Promise((res, rej) => {
      calls.push({
        src,
        signal,
        resolve: (status) => res({ ok: status >= 200 && status < 300, status, blob: async () => new Blob([`audio of ${src}`]) }),
        reject: rej,
      });
      signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
    });
  const p = new ClipPrefetch({ fetcher, toUrl: (b) => `blob:${b.size}:${calls.length}`, revoke: (u) => revoked.push(u), now: () => clock, ...o });
  const settle = () => new Promise<void>((r) => setImmediate(r));
  return { p, calls, revoked, settle, tick: (ms: number) => { clock += ms; } };
}

test('loads the nearest clips first, a few at a time, and the next as each one lands', async () => {
  const h = harness({ concurrency: 2 });
  h.p.want(['c1', 'c2', 'c3', 'c4']);
  assert.deepEqual(h.calls.map((c) => c.src), ['c1', 'c2']);
  h.calls[0].resolve(200);
  await h.settle();
  assert.deepEqual(h.calls.map((c) => c.src), ['c1', 'c2', 'c3']);
  assert.ok(h.p.ready('c1'));
  assert.ok(!h.p.ready('c2'));
});

test('a loaded clip plays from memory; one not loaded yet plays from its address', async () => {
  const h = harness();
  h.p.want(['c1']);
  h.calls[0].resolve(200);
  await h.settle();
  assert.match(h.p.urlFor('c1'), /^blob:/);
  assert.equal(h.p.urlFor('c9'), 'c9');
});

test('a seek drops the loads that are no longer near and starts the new place at once', async () => {
  const h = harness({ concurrency: 2 });
  h.p.want(['c1', 'c2', 'c3']);
  const first = h.calls.slice();
  h.p.want(['c40', 'c41']);
  assert.ok(first.every((c) => c.signal.aborted), 'the old loads are cancelled');
  assert.deepEqual(h.calls.slice(2).map((c) => c.src), ['c40', 'c41']);
});

test('a clip already loaded is not fetched again', async () => {
  const h = harness();
  h.p.want(['c1']);
  h.calls[0].resolve(200);
  await h.settle();
  h.p.want(['c1', 'c2']);
  h.p.want(['c1', 'c2']);
  assert.deepEqual(h.calls.map((c) => c.src), ['c1', 'c2']);
});

test('a clip the server is still making is asked again only after a pause', async () => {
  const h = harness({ retryMs: 4000 });
  h.p.want(['c1']);
  h.calls[0].resolve(503);
  await h.settle();
  h.p.want(['c1']);
  assert.equal(h.calls.length, 1, 'not hammered');
  h.tick(4000);
  h.p.want(['c1']);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].src, 'c1');
});

test('memory is bounded: clips far behind are let go, those wanted and the one playing are kept', async () => {
  const h = harness({ keep: 3, concurrency: 5 });
  h.p.want(['c1', 'c2', 'c3']);
  h.calls.forEach((c) => c.resolve(200));
  await h.settle();
  h.p.urlFor('c3');
  h.p.want(['c4', 'c5']);
  h.calls.slice(3).forEach((c) => c.resolve(200));
  await h.settle();
  assert.ok(h.p.ready('c4') && h.p.ready('c5'), 'what is wanted stays');
  assert.ok(h.p.ready('c3'), 'the clip just played stays');
  assert.equal(h.revoked.length, 2, 'the two oldest are released');
  assert.ok(!h.p.ready('c1') && !h.p.ready('c2'));
});

test('clear cancels and releases everything', async () => {
  const h = harness();
  h.p.want(['c1', 'c2']);
  h.calls[0].resolve(200);
  await h.settle();
  h.p.clear();
  assert.ok(h.calls[1].signal.aborted);
  assert.equal(h.revoked.length, 1);
  assert.equal(h.p.urlFor('c1'), 'c1');
});
