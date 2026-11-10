import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const out = new URL('src/version.ts', root);
const text = `export const PLAYER_VERSION = '${version}';\n`;
let had = '';
try { had = readFileSync(out, 'utf8'); } catch { }
if (had !== text) writeFileSync(out, text);
