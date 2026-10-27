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
}

[data-theme='light'] {
  --ct-ink: #ffffff;
  --ct-surface: #ffffff;
  --ct-surface-2: #ffffff;
  --ct-surface-3: #ffffff;
  --ct-text: #000000;
  --ct-faint: #777777;
  --ct-tint: rgba(0, 0, 0, 0.5);
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

test('every colour src/ paints as text meets its minimum on each light ground it sits on', () => {
  const failing = measure(rootDir, themeCss)
    .filter(({ ratio, minimum }) => ratio < minimum)
    .map(
      ({ fg, ground, ratio, minimum, where }) =>
        `${fg} on ${ground}: ${ratio.toFixed(2)} < ${minimum} (${where.join(', ')})`,
    );
  assert.deepEqual(failing, []);
});
