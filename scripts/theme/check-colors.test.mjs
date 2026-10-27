import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { check } from './check-colors.mjs';
import { THEME } from './theme-fixture.mjs';

const project = (files, allowlist = { tailBaseline: 0, entries: [] }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-colors-'));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write('src/theme.css', THEME);
  write('scripts/theme/color-allowlist.json', JSON.stringify(allowlist));
  for (const [file, text] of Object.entries(files)) write(file, text);
  return check(root).failures.map(({ file, rule, message }) => `${file} ${rule}: ${message}`);
};

test('tokens in the role they were made for pass', () => {
  assert.deepEqual(
    project({
      'src/card.css': `.card { color: var(--ct-gold); border: 1px solid var(--ct-line); background: var(--ct-surface-2); }
.card.active { background: var(--ct-gold-fill); border-color: var(--ct-gold-fill); color: var(--ct-on-gold); }
.fade { box-shadow: 0 4px 12px rgb(var(--ct-shadow-rgb) / 0.3); color: transparent; }`,
      'src/Card.js': `export const Card = () => (
  <div className="bg-[color:var(--ct-gold-fill)]" style={{ color: 'var(--ct-text)', background: 'var(--ct-surface-2)' }}>
    See statsplus#330 or /#/route.
  </div>
);`,
    }),
    [],
  );
});

test('a raw colour fails in CSS, Tailwind, inline styles and template literals', () => {
  assert.deepEqual(
    project({
      'src/unused.css': '.never-rendered { border-color: rgba(255, 255, 255, 0.1); }',
      'src/channels.css': '.run { --oc: 232, 163, 61; }',
      'src/Card.js': `export const Card = ({ a }) => (
  <div className="hover:border-[#e8a33d]" style={{ color: 'white', background: \`rgba(76, 175, 125, \${a})\` }} />
);`,
    }),
    [
      'src/Card.js raw-colour: raw colour #e8a33d',
      'src/Card.js raw-colour: raw colour white',
      'src/Card.js raw-colour: raw colour rgba(',
      'src/channels.css raw-colour: raw colour channels 232, 163, 61',
      'src/unused.css raw-colour: raw colour rgba(255, 255, 255, 0.1)',
    ],
  );
});

test('a token theme.css does not define fails', () => {
  assert.deepEqual(
    project({
      'src/card.css': '.card { color: var(--ct-golden); }',
      'src/Card.js': "export const style = { color: 'var(--ct-txt)' };",
    }),
    [
      'src/Card.js unknown-token: --ct-txt is not defined in src/theme.css',
      'src/card.css unknown-token: --ct-golden is not defined in src/theme.css',
    ],
  );
});

test('a text accent as a fill, or a fill as text, fails', () => {
  assert.deepEqual(
    project({
      'src/card.css': `.button { background: var(--ct-gold); }
.label { color: var(--ct-gold-fill); }
.edge { border: 1px solid var(--ct-gold-soft); }
.lettering { color: var(--ct-ink); }
.chip { background: var(--ct-gold-fill); border-color: var(--ct-gold); }`,
      'src/Card.js': `export const Card = () => (
  <div className="text-[color:var(--ct-hit-fill)]" style={{ backgroundColor: 'var(--ct-hit)' }} />
);`,
    }),
    [
      'src/Card.js role-misuse: fill token --ct-hit-fill in a fg role',
      'src/Card.js role-misuse: accent-fg token --ct-hit in a fill role',
      'src/card.css role-misuse: accent-fg token --ct-gold in a fill role',
      'src/card.css role-misuse: fill token --ct-gold-fill in a fg role',
      'src/card.css role-misuse: ladder-bg token --ct-gold-soft in a line role',
      'src/card.css role-misuse: dark ground --ct-ink as text; lettering on a fill uses an on-accent token',
      'src/card.css role-misuse: --ct-gold edges the fill it matches; use the fill token',
    ],
  );
});

test('an allowlisted literal passes, a stale entry fails, and tails may not grow', () => {
  const files = {
    'src/HostFrame.js': "export const HOST = { '--color-text-primary': '#f2f0e8' };",
  };
  const entry = { path: 'src/HostFrame.js', reason: "imitates Claude's host palette" };
  assert.deepEqual(project(files, { tailBaseline: 0, entries: [entry] }), []);
  assert.deepEqual(project({}, { tailBaseline: 0, entries: [entry] }), [
    'scripts/theme/color-allowlist.json stale-allowlist: nothing in src/HostFrame.js matches the entry; remove it',
  ]);
  const withTails = THEME.replace(
    ':root {',
    ':root {\n  --ct-x-191510: #191510;\n  --ct-on-000000: #000000;',
  );
  assert.deepEqual(project({ 'src/theme.css': withTails }, { tailBaseline: 1, entries: [] }), [
    'src/theme.css tail-ratchet: 2 legacy-shade tokens (--ct-x-*, --ct-on-<hex>) exceed the baseline of 1; use a named token',
  ]);
});
