import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { VoiceTrackRow } from '../src/core/voiceplayer.ts';

(globalThis as any).window ??= { location: { origin: 'http://localhost', hostname: 'localhost' } };
const { rowForVoice } = await import('../src/core/voiceplayer.ts');

const row = (voiceKey: string, voice: string | null = null): VoiceTrackRow => ({ lang: 'es', voiceKey, state: 'clips', clips: [1], voice } as VoiceTrackRow);

test('with no voice picked, only the default reading is used, never another one that happens to be listed first', () => {
  const stock = row('cast:0=M1');
  assert.equal(rowForVoice([stock], null), null, 'a stale stock reading is not taken for the default');
  const def = row('');
  assert.equal(rowForVoice([stock, def], null), def);
});

test('a picked voice finds its own reading', () => {
  const a = row('clone:x'), b = row('F2');
  assert.equal(rowForVoice([a, b], 'F2'), b);
  assert.equal(rowForVoice([a, b], 'M3'), null);
});
