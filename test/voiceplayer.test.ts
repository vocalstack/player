import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { VoiceTrackRow } from '../src/core/voiceplayer.ts';

(globalThis as any).window ??= { location: { origin: 'http://localhost', hostname: 'localhost' } };
const { rowForVoice, trackFor } = await import('../src/core/voiceplayer.ts');

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

test('the reading VocalStack chose for a kind is followed, whatever voice key the player guessed', () => {
  const cloned = { ...row('cast:0=clone:a;1=F2'), chosenFor: ['cloned'] } as VoiceTrackRow;
  const synthetic = { ...row('cast:0=M1;1=F2'), voices: 'synthetic', chosenFor: ['synthetic'] } as VoiceTrackRow;
  const old = { ...row('cast:0=M3;1=F1'), voices: 'synthetic' } as VoiceTrackRow;
  assert.equal(trackFor([old, cloned, synthetic], 'cloned', null), cloned);
  assert.equal(trackFor([old, cloned, synthetic], 'synthetic', 'cast:0=M2;1=F2'), synthetic);
  const both = { ...row('cast:0=M1'), chosenFor: ['cloned', 'synthetic'] } as VoiceTrackRow;
  assert.equal(trackFor([old, both], 'cloned', null), both);
  assert.equal(trackFor([old, both], 'synthetic', 'cast:0=M3;1=F1'), both);
});
