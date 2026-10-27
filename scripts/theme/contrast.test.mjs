import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { contrast, measure, palette } from './contrast.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const themeCss = fs.readFileSync(path.join(rootDir, 'src/theme.css'), 'utf8');

test('WCAG ratios match the published reference pairs', () => {
  assert.equal(contrast([0, 0, 0, 1], [255, 255, 255, 1]).toFixed(2), '21.00');
  assert.equal(contrast([118, 118, 118, 1], [255, 255, 255, 1]).toFixed(2), '4.54');
  // A translucent colour is measured as it paints over the ground.
  assert.equal(contrast([0, 0, 0, 0.5], [255, 255, 255, 1]).toFixed(2), '3.98');
});

test('light mode reads the light block over the root tokens', () => {
  const light = palette(themeCss, 'light');
  assert.deepEqual(light('--ct-ink'), [243, 244, 246, 1]);
  assert.deepEqual(light('--ct-gold'), [143, 84, 4, 1]);
  assert.deepEqual(light('--ct-gold-fill'), [232, 163, 61, 1]);
  assert.deepEqual(palette(themeCss, 'dark')('--ct-gold'), [232, 163, 61, 1]);
});

const THEME = `:root {
  --ct-ink: #0d0b07;
  --ct-surface: #16130d;
  --ct-surface-2: #1e1a12;
  --ct-surface-3: #241f15;
  --ct-text: #efe9dc;
  --ct-faint: #9b937f;
  --ct-tint: rgba(255, 255, 255, 0.5);
  --ct-on-ffffff: #ffffff;
  --ct-gold-fill: #e8a33d;
  --ct-on-gold: #000000;
  --ct-dim: #9b937f;
  --ct-chip: #3a3428;
  --ct-miss-soft: rgba(239, 68, 68, 0.2);
  --ct-x-e08585: #e08585;
}

[data-theme='light'] {
  --ct-ink: #ffffff;
  --ct-surface: #ffffff;
  --ct-surface-2: #ffffff;
  --ct-surface-3: #ffffff;
  --ct-text: #000000;
  --ct-faint: #777777;
  --ct-tint: rgba(0, 0, 0, 0.5);
  --ct-dim: #999999;
  --ct-chip: #dddddd;
  --ct-miss-soft: rgba(255, 0, 0, 0.2);
  --ct-x-e08585: #aa3333;
}
`;

const project = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'contrast-'));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write('src/theme.css', THEME);
  write('scripts/theme/color-allowlist.json', JSON.stringify({ tailBaseline: 0, entries: [] }));
  for (const [file, text] of Object.entries(files)) write(file, text);
  return measure(root, THEME).map(({ fg, ground, ratio, where }) => [
    fg,
    ground,
    ratio.toFixed(2),
    where,
  ]);
};

test('text is measured on its own rule’s ground, a tint composited over the page, else on every page ground', () => {
  assert.deepEqual(
    project({
      'src/card.css': `.tinted { background: var(--ct-tint); color: var(--ct-text); }
.plain { color: var(--ct-faint); }
.plain:disabled { color: var(--ct-faint); }
.badge { color: var(--ct-on-ffffff); }
.dash { color: var(--ct-faint); }
[data-theme='light'] .dash { color: var(--ct-text); }
[data-theme='dark'] .night { color: var(--ct-faint); }
`,
      'src/Tip.js': `export const Tip = () => <p style={{ color: 'var(--ct-faint)' }} />;\n`,
    }),
    [
      ['--ct-faint', 'page (--ct-ink)', '4.48', ['src/Tip.js:1', 'src/card.css:2 .plain']],
      ['--ct-text', '--ct-tint', '5.28', ['src/card.css:1 .tinted']],
      ['--ct-on-gold', '--ct-gold-fill', '9.74', ['src/theme.css']],
      ['--ct-text', 'page (--ct-ink)', '21.00', ['src/card.css:6 .dash']],
    ],
  );
});

test('a legacy shade is measured as text on the page and on a tint', () => {
  assert.deepEqual(
    project({
      'src/legacy.css': `.legacy { color: var(--ct-x-e08585); }
.legacy-chip { background: var(--ct-miss-soft); color: var(--ct-x-e08585); }
`,
    }),
    [
      ['--ct-x-e08585', '--ct-miss-soft', '4.57', ['src/legacy.css:2 .legacy-chip']],
      ['--ct-x-e08585', 'page (--ct-ink)', '6.50', ['src/legacy.css:1 .legacy']],
      ['--ct-on-gold', '--ct-gold-fill', '9.74', ['src/theme.css']],
    ],
  );
});

test('only a control that is disabled is exempt; one that is not disabled is measured', () => {
  assert.deepEqual(
    project({
      'src/controls.css': `.date:disabled { color: var(--ct-dim); }
.date[disabled] { color: var(--ct-dim); }
.date.disabled { color: var(--ct-dim); }
.date:hover:not(:disabled) { color: var(--ct-dim); }
.date:not([disabled]):focus-visible { color: var(--ct-dim); }
`,
    }),
    [
      [
        '--ct-dim',
        'page (--ct-ink)',
        '2.85',
        [
          'src/controls.css:4 .date:hover:not(:disabled)',
          'src/controls.css:5 .date:not([disabled]):focus-visible',
        ],
      ],
      ['--ct-on-gold', '--ct-gold-fill', '9.74', ['src/theme.css']],
    ],
  );
});

test('lettering on an accent its own rule paints is measured on that accent', () => {
  assert.deepEqual(
    project({
      'src/button.css': `.btn { background: var(--ct-gold-fill); color: var(--ct-on-ffffff); }\n`,
    }),
    [
      ['--ct-on-ffffff', '--ct-gold-fill', '2.16', ['src/button.css:1 .btn']],
      ['--ct-on-gold', '--ct-gold-fill', '9.74', ['src/theme.css']],
    ],
  );
});

test('a state that repaints only the ground is measured with the text its element already paints', () => {
  assert.deepEqual(
    project({
      'src/revoke.css': `.revoke { background: transparent; color: var(--ct-x-e08585); }
.revoke:hover:not(:disabled) { background: var(--ct-miss-soft); }
.revoke:disabled { background: var(--ct-text); }
.pill { background: var(--ct-chip); }
.pill.is-on { color: var(--ct-faint); }
.pill::before { background: var(--ct-text); }
`,
    }),
    [
      ['--ct-faint', '--ct-chip', '3.30', ['src/revoke.css:5 .pill.is-on']],
      [
        '--ct-x-e08585',
        '--ct-miss-soft',
        '4.57',
        ['src/revoke.css:2 .revoke:hover:not(:disabled)'],
      ],
      ['--ct-x-e08585', 'page (--ct-ink)', '6.50', ['src/revoke.css:1 .revoke']],
      ['--ct-on-gold', '--ct-gold-fill', '9.74', ['src/theme.css']],
    ],
  );
});

test('every colour src/ paints as text meets its minimum on each light ground it sits on', () => {
  const failing = measure(rootDir, themeCss)
    .filter(({ ratio, minimum }) => ratio < minimum)
    .map(
      ({ fg, ground, ratio, minimum, where }) =>
        `${fg} on ${ground}: ${ratio.toFixed(2)} < ${minimum} (${where.join(', ')})`,
    );
  assert.deepEqual(failing, []);
});
