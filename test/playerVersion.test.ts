import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { versionLine } from '../src/core/playerVersion.ts';
import { PLAYER_VERSION } from '../src/version.ts';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

test('the version shown is the package version, generated at build and on npm version', () => {
  assert.equal(PLAYER_VERSION, pkg.version, 'src/version.ts matches package.json (node scripts/version.mjs)');
});

test('the root settings screen shows the player version; a submenu does not', () => {
  assert.equal(versionLine(true), `Player ${pkg.version}`);
  assert.equal(versionLine(false), null);
});
