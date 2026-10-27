import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { check } from './check-colors.mjs';
import { isGenerated } from './roles.mjs';
import { TOKEN_REFERENCE_RE } from './sources.mjs';
import { THEME } from './theme-fixture.mjs';
import { renderGenerated } from './tokenize.mjs';

// The fixture theme plus the generated steps the files name, as the codemod
// would define them.
const themeFor = (files) => {
  const names = Object.values(files).flatMap((text) => text.match(TOKEN_REFERENCE_RE) ?? []);
  return `${THEME}\n${renderGenerated(new Set(names.filter(isGenerated)))}`;
};

const project = (files, allowlist = { tailBaseline: 0, entries: [] }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-colors-'));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write('src/theme.css', themeFor(files));
  write('scripts/theme/color-allowlist.json', JSON.stringify(allowlist));
  for (const [file, text] of Object.entries(files)) write(file, text);
  return check(root).failures.map(({ file, rule, message }) => `${file} ${rule}: ${message}`);
};

test('tokens in the role they were made for pass', () => {
  assert.deepEqual(
    project({
      'src/card.css': `.card { color: var(--ct-gold); border: 1px solid var(--ct-line); background: var(--ct-surface-2); }
.card.active { background: var(--ct-gold-fill); border-color: var(--ct-gold-fill); color: var(--ct-on-gold); }
.fade { box-shadow: 0 4px 12px rgb(var(--ct-shadow-rgb) / calc(0.3 * var(--ct-k-shadow))); color: transparent; }
.focus { box-shadow: 0 0 0 3px var(--ct-gold-fg-12), 0 6px 18px var(--ct-gold-bg-20); }
.rule { height: 1px; background: var(--ct-line); }
.bar { background: var(--ct-hit-fill-78); }
.badge { background: linear-gradient(135deg, var(--ct-gold-fill), var(--ct-hit-fill)); color: var(--ct-on-gold); }
.run { --oc: var(--ct-series-kept-fg-rgb); --oc-bg: var(--ct-series-kept-bg-rgb); }
.run mark { background: rgb(var(--oc-bg) / calc(0.16 * var(--ct-k-accent-bg))); color: rgb(var(--oc)); }`,
      'src/Card.js': `export const Card = () => (
  <div className="bg-[color:var(--ct-gold-fill)]" style={{ color: 'var(--ct-text)', background: 'var(--ct-surface-2)' }}>
    See statsplus#330 or <a href="#fee">/#/route</a>.
  </div>
);
export const tone = (kind) => (kind === 'red' ? 'var(--ct-hit)' : 'var(--ct-gold)');
export const fill = (family, a) => \`rgb(var(--ct-\${family}-bg-rgb) / calc(\${a} * var(--ct-k-accent-bg)))\`;`,
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
      'src/Card.js raw-colour: raw colour rgba(76, 175, 125, 1)',
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

test('a raw colour or a misused token fails through JS expressions, Chart.js options and canvas', () => {
  assert.deepEqual(
    project(
      {
        'src/Rank.js': `export const RankCube = ({ rank, x }) => (
  <div style={{ color: rank > 15 ? 'black' : 'white', background: x ? 'var(--ct-gold)' : 'var(--ct-hit)' }}>
    <svg><rect fill={'var(--ct-gold)'} /></svg>
  </div>
);
export const options = { pointBackgroundColor: 'white', hoverBorderColor: x || 'oklch(60% 0.2 30)' };
export const style = { color: \`white\`, border: \`1px solid \${x ? 'red' : 'var(--ct-line)'}\` };
export const paint = (ctx) => {
  ctx.fillStyle = 'red';
};
export const avatar = { background: 'linear-gradient(var(--ct-gold-fill), var(--ct-hit-fill))', border: '2px solid var(--ct-on-ffffff-40)', color: 'var(--ct-on-ffffff)' };
export const chip = { background: 'var(--ct-gold-fill)', color: 'var(--ct-text)' };
export const loose = { border: '2px solid var(--ct-on-ffffff-40)' };`,
      },
      { tailBaseline: 2, entries: [] },
    ),
    [
      'src/Rank.js raw-colour: raw colour black',
      'src/Rank.js raw-colour: raw colour white',
      'src/Rank.js role-misuse: accent-fg token --ct-gold in a fill role',
      'src/Rank.js role-misuse: accent-fg token --ct-hit in a fill role',
      'src/Rank.js role-misuse: accent-fg token --ct-gold in a fill role',
      'src/Rank.js raw-colour: raw colour white',
      'src/Rank.js raw-colour: raw colour oklch(60% 0.2 30)',
      'src/Rank.js raw-colour: raw colour white',
      'src/Rank.js raw-colour: raw colour red',
      'src/Rank.js raw-colour: raw colour red',
      'src/Rank.js role-misuse: page text --ct-text on an accent fill; lettering on a fill uses an on-accent token',
      'src/Rank.js role-misuse: on-accent token --ct-on-ffffff-40 in a line role',
    ],
  );
});

test('shadows, masks, channel alphas, aliases, hairlines, marks and lettering are checked by role', () => {
  assert.deepEqual(
    project({
      'src/card.css': `.ring { box-shadow: 0 0 0 1px var(--ct-overlay-bg-10), 0 0 0 2px var(--ct-gold-fill); }
.drop { box-shadow: 0 18px 50px var(--ct-scrim-75); }
.fade { mask-image: linear-gradient(var(--ct-text), transparent); }
.tint { background: rgb(var(--ct-gold-bg-rgb) / 0.4); box-shadow: 0 4px 12px rgb(var(--ct-shadow-rgb) / 0.3); }
.run { --oc: var(--ct-gold-fg-rgb); --ct-accent: var(--ct-gold); }
.run mark { background: rgb(var(--oc) / calc(0.16 * var(--ct-k-accent-fg))); border-color: var(--ct-accent); }
.run .wash { background: var(--ct-accent); }
.track { height: 4px; background: var(--ct-line); }
.bar { background: var(--ct-hit-bg-78); }
.weak { background: var(--ct-hit-fill-30); }
.card { background: var(--ct-surface-2); color: var(--ct-on-gold); }
.badge { background: linear-gradient(135deg, var(--ct-gold-fill), var(--ct-hit-fill)); color: var(--ct-text-max); }`,
    }),
    [
      'src/card.css role-misuse: ladder-bg token --ct-overlay-bg-10 in a ring role',
      'src/card.css role-misuse: fill token --ct-gold-fill in a ring role',
      'src/card.css role-misuse: scrim token --ct-scrim-75 in a shadow role',
      'src/card.css role-misuse: neutral token --ct-text in a mask role',
      'src/card.css multiplier: rgb(var(--ct-gold-bg-rgb) / 0.4) leaves out --ct-k-accent-bg; use a ladder token',
      'src/card.css multiplier: rgb(var(--ct-shadow-rgb) / 0.3) leaves out --ct-k-shadow; use a ladder token',
      'src/card.css role-misuse: ladder-fg token --ct-gold-fg-rgb in a fill role',
      'src/card.css role-misuse: accent-fg token --ct-gold in a fill role',
      'src/card.css role-misuse: line token --ct-line as a background; only a hairline box (1px wide, tall or gapped) paints one',
      'src/card.css role-misuse: --ct-hit-bg-78 paints a mark (alpha 0.5 and up); use --ct-hit-fill-*',
      'src/card.css role-misuse: --ct-hit-fill-30 paints a tint (alpha under 0.5); use --ct-hit-bg-*',
      'src/card.css role-misuse: on-accent token --ct-on-gold on a rule whose background is not an accent fill',
      'src/card.css role-misuse: page text --ct-text-max on an accent fill; lettering on a fill uses an on-accent token',
    ],
  );
});

test('theme.css rule bodies are checked, and its token definitions may only reference defined tokens without a cycle', () => {
  const theme = `${THEME}
:root {
  --ct-dim: var(--ct-dmi);
  --ct-a: var(--ct-b);
  --ct-b: var(--ct-a);
}
.btn-new { color: #fff; background: var(--ct-gold); }
`;
  assert.deepEqual(project({ 'src/theme.css': theme }), [
    'src/theme.css unknown-token: --ct-dmi is not defined in src/theme.css',
    'src/theme.css raw-colour: raw colour #fff',
    'src/theme.css role-misuse: accent-fg token --ct-gold in a fill role',
    'src/theme.css token-cycle: var() cycle --ct-a → --ct-b → --ct-a',
  ]);
});
