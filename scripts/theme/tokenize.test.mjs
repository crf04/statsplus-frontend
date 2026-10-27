import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildRegistry } from './roles.mjs';
import { THEME } from './theme-fixture.mjs';
import { tokenizeCss, tokenizeTailwind } from './tokenize.mjs';

const registry = buildRegistry(THEME);
const tokenize = (css) => tokenizeCss(css, registry).css;

test('amber text stays the text accent; an amber button becomes a fill with dark lettering', () => {
  const input = `.heading { color: #e8a33d; }
.chip { background: #1e1a12; border: 1px solid #e8a33d; color: #c9c2b2; }
.chip.active { background: #e8a33d; border-color: #e8a33d; color: #1a1408; }
.chip.active:hover { background: var(--ct-gold-hover); border-color: var(--ct-gold-hover); color: var(--ct-ink); }
`;
  assert.equal(
    tokenize(input),
    `.heading { color: var(--ct-gold); }
.chip { background: var(--ct-surface-2); border: 1px solid var(--ct-gold); color: var(--ct-text-2); }
.chip.active { background: var(--ct-gold-fill); border-color: var(--ct-gold-fill); color: var(--ct-on-gold); }
.chip.active:hover { background: var(--ct-gold-fill-hover); border-color: var(--ct-gold-fill-hover); color: var(--ct-on-0d0b07); }
`,
  );
});

test('a white border is a line and a white background is a wash', () => {
  const input = `.row { border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.row:hover { background: rgba(255, 255, 255, 0.1); }
.divider { border-top: 1px solid rgba(255, 255, 255, 0.08); }
.tint { background-color: rgba(232, 163, 61, 0.12); outline: 1px solid rgba(232, 163, 61, 0.12); }
`;
  assert.equal(
    tokenize(input),
    `.row { border-bottom: 1px solid var(--ct-overlay-fg-10); }
.row:hover { background: var(--ct-overlay-bg-10); }
.divider { border-top: 1px solid var(--ct-line); }
.tint { background-color: var(--ct-gold-soft); outline: 1px solid var(--ct-gold-fg-12); }
`,
  );
});

test('black shadows, scrims, rings, masks and legacy shades keep their exact value under a name', () => {
  const input = `.card { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05); }
.focus { box-shadow: 0 0 0 3px rgba(232, 163, 61, 0.2), 0 6px 18px rgba(232, 163, 61, 0.2); }
.backdrop { background: rgba(0, 0, 0, 0.6); }
.fade { mask-image: linear-gradient(90deg, #000 80%, transparent); }
.old { background: #191510; color: #ffffff; border-color: #ffffff14 !important; }
.pill { background: #ef4444; color: #fff; }
`;
  assert.equal(
    tokenize(input),
    `.card { box-shadow: 0 8px 24px var(--ct-shadow-45), inset 0 1px 0 var(--ct-overlay-fg-5); }
.focus { box-shadow: 0 0 0 3px var(--ct-gold-fg-20), 0 6px 18px var(--ct-gold-bg-20); }
.backdrop { background: var(--ct-scrim-60); }
.fade { mask-image: linear-gradient(90deg, var(--ct-mask) 80%, transparent); }
.old { background: var(--ct-x-191510); color: var(--ct-text-max); border-color: var(--ct-overlay-fg-x14) !important; }
.pill { background: var(--ct-x-ef4444-fill); color: var(--ct-on-ffffff); }
`,
  );
});

test('white lettering on an opaque accent gradient is on-accent; a translucent gradient is a wash', () => {
  const input = `.win { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: 1px solid #059669; }
.tokens { background: linear-gradient(90deg, var(--ct-gold-fill), var(--ct-hit-fill)); color: var(--ct-text-max); }
.wash { background: linear-gradient(rgba(232, 163, 61, 0.2), #e8a33d); color: #fff; }
`;
  assert.equal(
    tokenize(input),
    `.win { background: linear-gradient(135deg, var(--ct-x-10b981-fill) 0%, var(--ct-x-059669-fill) 100%); color: var(--ct-on-ffffff); border: 1px solid var(--ct-x-059669-fill); }
.tokens { background: linear-gradient(90deg, var(--ct-gold-fill), var(--ct-hit-fill)); color: var(--ct-on-ffffff); }
.wash { background: linear-gradient(var(--ct-gold-bg-20), var(--ct-gold-fill)); color: var(--ct-text-max); }
`,
  );
});

test('accent paint from alpha 0.5 up is a mark on the fill ladder; a ring is a line; a line colour fills only a hairline', () => {
  const input = `.over { background: rgba(76, 175, 125, 0.78); }
.edge { background: rgba(76, 175, 125, 0.5); }
.tint { background: rgba(76, 175, 125, 0.49); }
.grade { background: var(--ct-hit-bg-76); }
.weak { background: var(--ct-hit-fill-30); }
.focus { box-shadow: 0 0 0 3px var(--ct-gold-soft); }
.track { height: 3px; background: var(--ct-line); }
.rule { width: 1px; background: var(--ct-line); }
`;
  assert.equal(
    tokenize(input),
    `.over { background: var(--ct-hit-fill-78); }
.edge { background: var(--ct-hit-fill-50); }
.tint { background: var(--ct-hit-bg-49); }
.grade { background: var(--ct-hit-fill-76); }
.weak { background: var(--ct-hit-bg-30); }
.focus { box-shadow: 0 0 0 3px var(--ct-gold-fg-12); }
.track { height: 3px; background: var(--ct-overlay-bg-8); }
.rule { width: 1px; background: var(--ct-line); }
`,
  );
});

test('a second run changes nothing', () => {
  const once = tokenize(`.a { color: #e8a33d; background: rgba(232, 163, 61, 0.05); }
.b { background: var(--ct-gold); border: 1px solid var(--ct-gold); color: #000000; }
`);
  assert.equal(tokenize(once), once);
  assert.deepEqual(tokenizeCss(once, registry).rewrites, []);
});

test('colours it cannot name exactly are reported, not guessed', () => {
  const { css, leftovers } = tokenizeCss(
    `.dot { --oc: 232, 163, 61; --z: 100; background: hsl(calc(var(--rank) * 4) 62% 46%); }
.chevron { background-image: url("data:image/svg+xml,%3Csvg stroke='%239b937f'/%3E"); }
`,
    registry,
  );
  assert.deepEqual(
    leftovers.map(({ prop, reason }) => [prop, reason]),
    [
      ['--oc', 'custom-property'],
      ['background', 'computed-hsl'],
      ['background-image', 'data-uri'],
    ],
  );
  assert.match(css, /--oc: 232, 163, 61/);
});

test('Tailwind arbitrary colours take a typed token', () => {
  const { source } = tokenizeTailwind(
    "className={`bg-[#16130d] border-[#ffffff14] hover:border-[#e8a33d] ${up ? 'text-[#4caf7d]' : 'bg-[color:var(--ct-gold)]'}`}",
    buildRegistry(THEME.replace('--ct-ink', '--ct-surface: #16130d;\n  --ct-ink')),
  );
  assert.equal(
    source,
    "className={`bg-[color:var(--ct-surface)] border-[color:var(--ct-overlay-fg-x14)] hover:border-[color:var(--ct-gold)] ${up ? 'text-[color:var(--ct-hit)]' : 'bg-[color:var(--ct-gold-fill)]'}`}",
  );
});

test('the CLI defines the tokens it writes in theme.css, and a second --write is empty', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenize-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.copyFileSync(
    new URL('../../.prettierrc.json', import.meta.url),
    path.join(root, '.prettierrc.json'),
  );
  fs.writeFileSync(path.join(root, 'src/theme.css'), THEME);
  fs.writeFileSync(
    path.join(root, 'src/card.css'),
    '.card {\n  background: rgba(232, 163, 61, 0.05);\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);\n  color: #c24e4e;\n}\n.bar {\n  background: rgba(76, 175, 125, 0.78);\n}\n',
  );
  const cli = fileURLToPath(new URL('./tokenize.mjs', import.meta.url));
  const run = (...args) =>
    execFileSync(process.execPath, [cli, '--root', root, ...args]).toString();

  run('--write');
  assert.equal(
    fs.readFileSync(path.join(root, 'src/card.css'), 'utf8'),
    '.card {\n  background: var(--ct-gold-bg-5);\n  box-shadow: 0 4px 12px var(--ct-shadow-30);\n  color: var(--ct-x-c24e4e);\n}\n.bar {\n  background: var(--ct-hit-fill-78);\n}\n',
  );
  const theme = fs.readFileSync(path.join(root, 'src/theme.css'), 'utf8');
  assert.ok(theme.startsWith(THEME));
  assert.match(theme, /:root \{\n {2}--ct-x-c24e4e: #c24e4e;\n\}/);
  assert.match(
    theme,
    /:root,\n\[data-theme\] \{\n {2}--ct-gold-bg-5: rgb\(var\(--ct-gold-bg-rgb\) \/ calc\(0\.05 \* var\(--ct-k-accent-bg\)\)\);\n {2}--ct-hit-fill-78: rgb\(var\(--ct-hit-fill-rgb\) \/ 0\.78\);\n {2}--ct-shadow-30: rgb\(var\(--ct-shadow-rgb\) \/ calc\(0\.3 \* var\(--ct-k-shadow\)\)\);\n\}/,
  );

  const snapshot = () =>
    ['src/theme.css', 'src/card.css'].map((file) => fs.readFileSync(path.join(root, file), 'utf8'));
  const before = snapshot();
  assert.match(run('--check'), /0 file\(s\) change/);
  run('--write');
  assert.deepEqual(snapshot(), before);
});
