import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRegistry } from './roles.mjs';
import { THEME } from './theme-fixture.mjs';
import { compareCss } from './verify-dark.mjs';

const registry = buildRegistry(THEME);
const compare = (base, head) => compareCss(base, head, 'src/a.css', registry, registry);

test('a rewrite onto tokens that paint the same dark colour passes', () => {
  const result = compare(
    `.a { color: #e8a33d; background: rgba(232, 163, 61, 0.2); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important; }
.b { --oc: 232, 163, 61; }
mark { background: rgba(var(--oc), 0.16); }`,
    `.a { color: var(--ct-gold); background: var(--ct-gold-bg-20); box-shadow: 0 1px 2px var(--ct-shadow-30) !important; }
.b { --oc: var(--ct-gold-fg-rgb); --oc-bg: var(--ct-gold-bg-rgb); }
mark { background: rgb(var(--oc-bg) / calc(0.16 * var(--ct-k-accent-bg))); }`,
  );
  assert.deepEqual(result, { compared: 5, rewritten: 5, mismatches: [] });
});

test('a changed alpha, a dropped !important, a removed or reordered declaration and a wrong alias split fail', () => {
  const { mismatches } = compare(
    `.a { background: rgba(232, 163, 61, 0.2); }
.c { color: #fff !important; }
.d { border-color: #fff; color: #000; }
.e { background: #000; background-color: #fff; }
.p { --oc: 232, 163, 61; }
mark { background: rgba(var(--oc), 0.16); }`,
    `.a { background: var(--ct-gold-bg-21); }
.c { color: var(--ct-text-max); }
.d { color: var(--ct-on-000000); }
.e { background-color: #fff; background: #000; }
.p { --oc: var(--ct-gold-fg-rgb); --oc-bg: var(--ct-hit-bg-rgb); }
mark { background: rgb(var(--oc-bg) / calc(0.16 * var(--ct-k-accent-bg))); }`,
  );
  assert.deepEqual(mismatches, [
    {
      file: 'src/a.css',
      key: '.a { background #0',
      base: 'rgba(232, 163, 61, 0.2)',
      head: 'rgba(232, 163, 61, 0.21)',
    },
    {
      file: 'src/a.css',
      key: '.c { color #0',
      base: 'rgba(255, 255, 255, 1) !important',
      head: 'rgba(255, 255, 255, 1)',
    },
    { file: 'src/a.css', key: '.d { border-color #0', base: '#fff', head: '(removed)' },
    {
      file: 'src/a.css',
      key: '.e { background-color #0',
      base: 'in source order',
      head: '(moved earlier)',
    },
    {
      file: 'src/a.css',
      key: 'mark { background #0 [.p]',
      base: 'rgba(232, 163, 61, 0.16)',
      head: 'rgba(76, 175, 125, 0.16)',
    },
  ]);
});
