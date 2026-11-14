import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choiceFor, kindFor, mdPage, parseClock, srtAsVtt, tabOf, vttCues } from '../src/core/exportOptions.ts';

const PREFS = {
  speakers: { pdf: 'on', xlsx: 'off' },
  timestamps: { pdf: 'off', text: 'line' },
  subs: 'vtt',
  text: 'md',
  summary: true,
} as const;

test('times parse as seconds, minutes:seconds or hours:minutes:seconds', () => {
  assert.equal(parseClock('90'), 90);
  assert.equal(parseClock('12:30'), 750);
  assert.equal(parseClock('1:02:45'), 3765);
  assert.equal(parseClock(''), null);
  assert.equal(parseClock('12m'), null);
});

test('a format button follows the saved choices of its tab', () => {
  assert.equal(tabOf('srt'), 'subs');
  assert.equal(tabOf('md'), 'text');
  assert.equal(kindFor('subs', PREFS), 'vtt');
  assert.equal(kindFor('text', PREFS), 'md');
  assert.deepEqual(choiceFor('pdf', PREFS, { startS: 10 }), { startS: 10, speakerLabels: 'on', timestamps: 'off', summary: true });
  assert.deepEqual(choiceFor('xlsx', PREFS), { speakerLabels: 'off' });
  assert.deepEqual(choiceFor('subs', PREFS), {});
  assert.deepEqual(choiceFor('json', PREFS), { summary: true });
});

test('WebVTT cues read back with their speaker', () => {
  const cues = vttCues('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.500\n<v Ana>Ana: Hello there.\n\n2\n00:01:04.000 --> 00:01:06.000\nNo name.\n');
  assert.deepEqual(cues, [
    { start: '00:01', end: '00:03', who: 'Ana', text: 'Hello there.' },
    { start: '01:04', end: '01:06', who: '', text: 'No name.' },
  ]);
  assert.equal(srtAsVtt('00:00:01,250 --> 00:00:02,000'), '00:00:01.250 --> 00:00:02.000');
});

test('the Markdown export reads back as a page', () => {
  const p = mdPage('# Board call\n\n_2026-11-14 · 42:10 · EN_\n\n## Summary\n\nThey agreed\\.\n\n## Transcript\n\n**Ana** `00:04`  \nLet\\\'s start\\.\n\n`00:09`  \nStill Ana.\n\nNo head.\n');
  assert.equal(p.title, 'Board call');
  assert.equal(p.meta, '2026-11-14 · 42:10 · EN');
  assert.deepEqual(p.summary, ['They agreed.']);
  assert.deepEqual(p.blocks, [
    { who: 'Ana', when: '00:04', text: "Let's start." },
    { who: '', when: '00:09', text: 'Still Ana.' },
    { who: '', when: '', text: 'No head.' },
  ]);
});
