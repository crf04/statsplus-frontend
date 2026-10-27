import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chalk, CHALK } from './chalk.mjs';
import { luminance, parseColor } from './colors.mjs';
import { contrast } from './contrast.mjs';
import { LIGHT_END, LIGHT_START, withLightTails } from './light-tails.mjs';
import { THEME } from './theme-fixture.mjs';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('Chalk maps each of palette B anchors to its light shade', () => {
  for (const [dark, light] of CHALK.neutrals) {
    assert.deepEqual(chalk([...rgb(dark), 1], 'fill'), [...rgb(light), 1], dark);
  }
});

test('translucent white lines strengthen, washes fade, tints strengthen and shadows lighten', () => {
  assert.deepEqual(chalk([255, 255, 255, 0.1], 'text'), [21, 24, 29, 0.135]);
  assert.deepEqual(chalk([255, 255, 255, 0.1], 'fill'), [21, 24, 29, 0.055]);
  assert.deepEqual(chalk([239, 68, 68, 0.2], 'fill'), [239, 68, 68, 0.27]);
  assert.deepEqual(chalk([0, 0, 0, 0.3], 'shadow'), [0, 0, 0, 0.105]);
  assert.deepEqual(chalk([13, 11, 7, 0.94], 'fill'), [243, 244, 246, 0.94]);
});

const theme = (extraDark, light) => `${THEME}
:root,
[data-theme='dark'] {
${extraDark}
}

[data-theme='light'] {
  --ct-ink: #f3f4f6;

  ${LIGHT_START}
${light}
  ${LIGHT_END}
}
`;

test('each legacy shade gets its Chalk value in the light block, lettering on an accent keeps its own', () => {
  const before = theme(
    `  --ct-x-000000: #000000;
  --ct-x-ef4444-20: rgba(239, 68, 68, 0.2);
  --ct-on-1a1206: #1a1206;`,
    '',
  );
  const after = withLightTails(before);
  assert.equal(
    after,
    theme(
      `  --ct-x-000000: #000000;
  --ct-x-ef4444-20: rgba(239, 68, 68, 0.2);
  --ct-on-1a1206: #1a1206;`,
      `  --ct-x-000000: #eceef0;
  --ct-x-ef4444-20: rgba(239, 68, 68, 0.27);`,
    ),
  );
  assert.equal(withLightTails(after), after);
});

test('a shade added in dark makes the light block stale until the next run', () => {
  const current = withLightTails(theme('  --ct-x-000000: #000000;', ''));
  const added = current.replace(
    '  --ct-x-000000: #000000;\n',
    '  --ct-x-000000: #000000;\n  --ct-x-0d0b07: #0d0b07;\n',
  );
  assert.notEqual(withLightTails(added), added);
  assert.match(withLightTails(added), /--ct-x-0d0b07: #f3f4f6;/);
});

test('a legacy amber fill stays a bright fill while the same amber as text darkens to read on white', () => {
  const after = withLightTails(
    theme(
      `  --ct-x-f0a030: #f0a030;
  --ct-x-f0a030-fill: #f0a030;`,
      '',
    ),
  );
  const lightOf = (name) =>
    parseColor(
      after.slice(after.indexOf(LIGHT_START)).match(new RegExp(`${name}: (#[0-9a-f]{6})`))[1],
    );
  assert.ok(luminance(lightOf('--ct-x-f0a030-fill')) > 0.4);
  assert.ok(contrast(lightOf('--ct-x-f0a030'), [255, 255, 255, 1]) >= 4.5);
});
