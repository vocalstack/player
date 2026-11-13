import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardTxOf } from '../src/core/dashboard.ts';

const ID = '01a1c5f8-c87a-7cc3-a072-5df97f66f01c';

test('a Dashboard transcription link gives its transcription id', () => {
  assert.equal(dashboardTxOf(`http://localhost:5176/transcriptions/${ID}?panel=speakers`), ID);
  assert.equal(dashboardTxOf(`https://app.vocalstack.com/transcriptions/${ID}`), ID);
  assert.equal(dashboardTxOf(`app.vocalstack.com/transcriptions/${ID}/r/01a1c5f8-9f8d-7923-bec8-1975868c1ed6?segment=12`), ID);
  assert.equal(dashboardTxOf(`http://127.0.0.1:4000/transcriptions/${ID.toUpperCase()}/`), ID);
  assert.equal(dashboardTxOf(`  https://app.vocalstack.com/transcriptions/${ID}/live  `), ID);
});

test('the configured app origin counts as the Dashboard', () => {
  assert.equal(dashboardTxOf(`https://app.example.org/transcriptions/${ID}`, 'https://app.example.org'), ID);
  assert.equal(dashboardTxOf(`https://app.example.org/transcriptions/${ID}`), null);
  assert.equal(dashboardTxOf(`https://app.example.org:8443/transcriptions/${ID}`, 'https://app.example.org'), null);
});

test('other links are not Dashboard transcriptions', () => {
  assert.equal(dashboardTxOf('https://app.vocalstack.com/transcriptions'), null);
  assert.equal(dashboardTxOf('https://app.vocalstack.com/transcriptions/new/url'), null);
  assert.equal(dashboardTxOf(`https://app.vocalstack.com/transcriptions/${ID}/crop`), null);
  assert.equal(dashboardTxOf('http://localhost:5176/t/hvzbftnkie54'), null);
  assert.equal(dashboardTxOf(`https://evil.example.com/transcriptions/${ID}`), null);
  assert.equal(dashboardTxOf(`https://app.vocalstack.com.evil.com/transcriptions/${ID}`), null);
  assert.equal(dashboardTxOf(`javascript://app.vocalstack.com/transcriptions/${ID}`), null);
  assert.equal(dashboardTxOf('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(dashboardTxOf(''), null);
});
