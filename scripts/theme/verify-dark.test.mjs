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
mark { background: rgba(var(--oc), 0.16); }
.q { --tint: 76, 175, 125; }
.q i { background: rgba(var(--tint), 0.2); }`,
    `.a { color: var(--ct-gold); background: var(--ct-gold-bg-20); box-shadow: 0 1px 2px var(--ct-shadow-30) !important; }
.b { --oc: var(--ct-gold-fg-rgb); --oc-bg: var(--ct-gold-bg-rgb); }
mark { background: rgb(var(--oc-bg) / calc(0.16 * var(--ct-k-accent-bg))); }
.q { --tint-bg: var(--ct-hit-bg-rgb); }
.q i { background: rgb(var(--tint-bg) / calc(0.2 * var(--ct-k-accent-bg))); }`,
  );
  assert.deepEqual(result, { compared: 6, rewritten: 6, mismatches: [] });
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

test('an alias added, removed, moved or given a second setter fails even when its consumer is unchanged', () => {
  const consumer = 'mark { background: rgb(var(--oc) / 0.16); }';
  const cases = [
    compare('.x { color: var(--tone, #fff); }', '.x { --tone: #000; color: var(--tone, #fff); }'),
    compare(`.p { --oc: 232 163 61; }\n${consumer}`, consumer),
    compare(`.p { --oc: 232 163 61; }\n${consumer}`, `.q { --oc: 232 163 61; }\n${consumer}`),
    compare(
      `.p { --oc: 232 163 61; }\n${consumer}`,
      `.p { --oc: 232 163 61; }\n.q { --oc: 76 175 125; }\n${consumer}`,
    ),
  ];
  assert.deepEqual(
    cases.map(({ mismatches }) => mismatches),
    [
      [
        {
          file: 'src/a.css',
          key: '.x { color #0 [.x]',
          base: 'var(--tone, rgba(255, 255, 255, 1))',
          head: 'rgba(0, 0, 0, 1)',
        },
      ],
      [
        { file: 'src/a.css', key: '--oc', base: 'set in .p', head: '(removed, still read)' },
        {
          file: 'src/a.css',
          key: 'mark { background #0 [.p]',
          base: 'rgba(232, 163, 61, 0.16)',
          head: 'rgb(var(--oc) / 0.16)',
        },
      ],
      [{ file: 'src/a.css', key: '--oc', base: 'set in .p', head: 'set in .q' }],
      [
        { file: 'src/a.css', key: '--oc', base: 'set in .p', head: 'set in .p, .q' },
        {
          file: 'src/a.css',
          key: 'mark { background #0 [.q]',
          base: 'rgba(232, 163, 61, 0.16)',
          head: 'rgba(76, 175, 125, 0.16)',
        },
      ],
    ],
  );
});

test('an alias set in several rules is resolved in each, so a rewrite that keeps every rule passes', () => {
  const result = compare(
    `.p { --oc: 232, 163, 61; }
.q { --oc: 76, 175, 125; }
mark { background: rgba(var(--oc), 0.16); }`,
    `.p { --oc: var(--ct-gold-fg-rgb); }
.q { --oc: var(--ct-hit-fg-rgb); }
mark { background: rgb(var(--oc) / calc(0.16 * var(--ct-k-accent-fg))); }`,
  );
  assert.deepEqual(result, { compared: 3, rewritten: 3, mismatches: [] });
});

test('a rule pinned to dark as well keeps its scope, and light-only rules paint nothing in dark', () => {
  const result = compare(
    `:root { --ct-ink: #0d0b07; }
.a { color: #e8a33d; }`,
    `:root,
[data-theme='dark'] { --ct-ink: #0d0b07; }
.a { color: var(--ct-gold); }
[data-theme='light'] { --ct-ink: #f3f4f6; color-scheme: light; }
[data-theme='light'] .a, [data-theme-switching] * { color: #9a5b06; transition: none; }`,
  );
  assert.deepEqual(result, { compared: 2, rewritten: 1, mismatches: [] });
});

test('a rule that also paints dark is still compared, even beside a light selector', () => {
  const { mismatches } = compare(
    `.a { color: #e8a33d; }`,
    `.a, [data-theme='light'] .b { color: var(--ct-hit); }`,
  );
  assert.deepEqual(mismatches, [
    {
      file: 'src/a.css',
      key: '.a { color #0',
      base: 'rgba(232, 163, 61, 1)',
      head: 'rgba(76, 175, 125, 1)',
    },
  ]);
});
