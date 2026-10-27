import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { contrast, measure, palette } from './contrast.mjs';

const themeCss = fs.readFileSync(new URL('../../src/theme.css', import.meta.url), 'utf8');

test('WCAG ratios match the published reference pairs', () => {
  assert.equal(contrast([0, 0, 0, 1], [255, 255, 255, 1]).toFixed(2), '21.00');
  assert.equal(contrast([118, 118, 118, 1], [255, 255, 255, 1]).toFixed(2), '4.54');
  // A translucent colour is measured as it paints over the ground.
  assert.equal(contrast([0, 0, 0, 0.5], [255, 255, 255, 1]).toFixed(2), '3.98');
});

test('light mode reads the light block over the root tokens', () => {
  const light = palette(themeCss, 'light');
  assert.deepEqual(light('--ct-ink'), [243, 244, 246, 1]);
  assert.deepEqual(light('--ct-gold'), [154, 91, 6, 1]);
  assert.deepEqual(light('--ct-gold-fill'), [232, 163, 61, 1]);
  assert.deepEqual(palette(themeCss, 'dark')('--ct-gold'), [232, 163, 61, 1]);
});

test('every named light text colour passes WCAG AA on each light ground', () => {
  const failing = measure(themeCss, 'light')
    .filter(({ ratio, minimum }) => ratio < minimum)
    .map(
      ({ fg, ground, ratio, minimum }) => `${fg} on ${ground}: ${ratio.toFixed(2)} < ${minimum}`,
    );
  assert.deepEqual(failing, []);
});
