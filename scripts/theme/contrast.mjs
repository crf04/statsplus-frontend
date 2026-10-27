#!/usr/bin/env node
// WCAG contrast of the named text colours on the grounds they sit on, in
// each theme, from src/theme.css. `node scripts/theme/contrast.mjs` prints the
// table; contrast.test.mjs holds light mode to AA.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { evaluateColor, luminance } from './colors.mjs';
import { definitionOf } from './roles.mjs';
import { THEME_FILE } from './sources.mjs';

// Body text needs 4.5:1; large text and UI marks (a chart's comparison line) 3:1.
export const PAIRS = [
  ...['--ct-text', '--ct-text-2', '--ct-text-max', '--ct-dim'].map((fg) => [fg, 4.5]),
  ...['--ct-gold', '--ct-gold-hover', '--ct-gold-press', '--ct-hit', '--ct-miss'].map((fg) => [
    fg,
    4.5,
  ]),
  ['--ct-slate', 3],
].flatMap(([fg, minimum]) =>
  ['--ct-ink', '--ct-surface', '--ct-surface-2', '--ct-surface-3'].map((ground) => ({
    fg,
    ground,
    minimum,
  })),
);
export const ACCENT_PAIRS = [{ fg: '--ct-on-gold', ground: '--ct-gold-fill', minimum: 4.5 }];

const selectorsOf = (rule) => rule.selector.split(',').map((part) => part.trim());

// Token name → colour in `theme` ('dark' or 'light'): the root's
// declarations, overridden by the theme's own block.
export const palette = (themeCss, theme) => {
  const declared = new Map();
  const collect = (match) =>
    postcss.parse(themeCss).walkRules((rule) => {
      if (!selectorsOf(rule).some(match)) return;
      rule.walkDecls((decl) => {
        if (decl.prop.startsWith('--ct-')) declared.set(decl.prop, decl.value.trim());
      });
    });
  collect((selector) => selector === ':root');
  if (theme !== 'dark') collect((selector) => selector === `[data-theme='${theme}']`);
  const lookup = (name) => declared.get(name) ?? definitionOf(name) ?? undefined;
  return (name) => evaluateColor(lookup(name), lookup);
};

// The colour a translucent foreground paints over an opaque ground.
const over = ([r, g, b, a], [gr, gg, gb]) => [
  r * a + gr * (1 - a),
  g * a + gg * (1 - a),
  b * a + gb * (1 - a),
  1,
];

export const contrast = (fg, ground) => {
  const [a, b] = [luminance(over(fg, ground)), luminance(ground)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

export const measure = (themeCss, theme) => {
  const colorOf = palette(themeCss, theme);
  return [...PAIRS, ...ACCENT_PAIRS].map((pair) => ({
    ...pair,
    ratio: contrast(colorOf(pair.fg), colorOf(pair.ground)),
  }));
};

const main = () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const css = fs.readFileSync(path.join(rootDir, THEME_FILE), 'utf8');
  const dark = measure(css, 'dark');
  console.log('| Text | Ground | Light | Dark | AA |');
  console.log('| --- | --- | --- | --- | --- |');
  measure(css, 'light').forEach(({ fg, ground, minimum, ratio }, i) => {
    const pass = ratio >= minimum ? 'pass' : 'FAIL';
    console.log(
      `| \`${fg}\` | \`${ground}\` | ${ratio.toFixed(2)} | ${dark[i].ratio.toFixed(2)} | ${minimum}:1 ${pass} |`,
    );
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
