#!/usr/bin/env node
// WCAG contrast of every colour src/ paints as text, on the ground it sits on,
// in light mode, from src/theme.css. Text sits on the background its selector
// paints, or failing that the one its selector without its last state paints
// (`.a:hover` → `.a`); a state that repaints only the background keeps the
// text its element paints. A translucent ground is composited over each page
// ground; text with no ground is measured on every page ground.
// `node scripts/theme/contrast.mjs` prints the table; contrast.test.mjs fails
// on a pair under its minimum.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { check } from './check-colors.mjs';
import { evaluateColor, luminance } from './colors.mjs';
import { definitionOf } from './roles.mjs';
import { THEME_FILE, isStylesheet } from './sources.mjs';

export const TEXT_MINIMUM = 4.5;

// The opaque grounds of the page, its cards and their raised rows.
export const PAGE_GROUNDS = ['--ct-ink', '--ct-surface', '--ct-surface-2', '--ct-surface-3'];

// Text held to less than 4.5:1, each with the reason. `minimum: 0` measures
// nothing.
export const EXEMPT = [
  {
    test: ({ selector }) =>
      /:disabled|\[disabled\]|\.disabled\b/.test(selector.replace(NEGATION, '')),
    minimum: 0,
    reason: 'an inactive control; WCAG 1.4.3 exempts it',
  },
  {
    test: ({ fg, grounds }) => fg.startsWith('var(--ct-on-') && grounds === null,
    minimum: 0,
    reason:
      'lettering on an accent fill its component paints elsewhere or picks at runtime (a rank hue, a Bootstrap badge); the lint holds on-accent tokens to accent fills, and both keep their colour in every theme',
  },
];

// Lettering on a fill the component picks at runtime (a rank hue, an avatar
// colour), measured where the fill is known: on its own fill in this table.
export const ACCENT_PAIRS = [{ fg: '--ct-on-gold', ground: '--ct-gold-fill', minimum: 4.5 }];

const TEXT_PROPS = new Set(['color', '-webkit-text-fill-color']);

// `:not(…)`, one level of nesting deep: what it names the subject is not.
const NEGATION = /:not\((?:[^()]|\([^()]*\))*\)/g;

const selectorsOf = (rule) => rule.selector.split(',').map((part) => part.trim());

// Token name or CSS colour value → colour in `theme` ('dark' or 'light'): the
// root's declarations, overridden by the theme's own block.
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
  return (text) => {
    const value = text.startsWith('--') ? lookup(text) : text;
    return value === undefined ? null : evaluateColor(value, lookup);
  };
};

// The colour a translucent foreground paints over an opaque ground.
export const over = ([r, g, b, a], [gr, gg, gb]) => [
  r * a + gr * (1 - a),
  g * a + gg * (1 - a),
  b * a + gb * (1 - a),
  1,
];

export const contrast = (fg, ground) => {
  const [a, b] = [luminance(over(fg, ground)), luminance(ground)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

const THEMED = /^\[data-theme=['"]?(light|dark)['"]?\]\s*/;

// The theme a selector paints in (null: every theme) and the selector without
// its theme prefix.
const themed = (selector) => {
  const match = selector.match(THEMED);
  return match ? [match[1], selector.slice(match[0].length)] : [null, selector];
};

const colorRefs = (value) => {
  const refs = [];
  valueParser(value).walk((node) => {
    if (node.type === 'function' && node.value === 'var') {
      if (node.nodes[0]?.value.startsWith('--ct-')) refs.push(`var(${node.nodes[0].value})`);
      return false;
    }
    return undefined;
  });
  return refs;
};

// The colours a value paints: itself when it evaluates to one, else each
// token it names (a fallback, a gradient's stops).
const paintsOf = (value, colorOf) => (colorOf(value) ? [value] : colorRefs(value));

// What a rule paints behind its content: its last background naming a colour.
const backgroundOf = (rule, colorOf) => {
  let grounds = null;
  rule?.each((node) => {
    if (node.type !== 'decl' || !/^background(-color)?$/.test(node.prop)) return;
    const paints = paintsOf(node.value, colorOf);
    if (paints.length) grounds = paints;
  });
  return grounds;
};

const STATE = /(?:\.[\w-]+|\[[^\]]*\]|::?[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?)$/;
const PART = /(?:::[\w-]+|:(?:before|after))$/;

// The selector without the last class, attribute or pseudo of its subject,
// null when the subject is a single simple selector.
const baseOf = (selector) => {
  const match = selector.match(STATE);
  const base = match ? selector.slice(0, match.index) : '';
  return base && !/[\s>+~(]$/.test(base) ? base : null;
};

const minimumOf = (use) => EXEMPT.find((entry) => entry.test(use))?.minimum ?? TEXT_MINIMUM;

// A rule for this theme replaces what the same selector paints in every theme.
const forTheme = (byTheme, theme) => byTheme.get(theme) ?? byTheme.get(null) ?? null;

// Every colour src/ paints as text, with what it sits on, where it is and the
// contrast it needs.
export const textUses = (rootDir, themeCss, theme) => {
  const colorOf = palette(themeCss, theme);
  // What each selector paints, from every rule naming it: text colours and
  // grounds, each by theme (null: every theme).
  const painted = new Map();
  const inline = [];
  check(rootDir, {
    onPaint: ({ file, line, prop, role, value, rule }) => {
      const isText = role === 'fg' && (prop === null || TEXT_PROPS.has(prop));
      if (!isStylesheet(file)) {
        if (!isText) return;
        const grounds = backgroundOf(rule, colorOf);
        for (const fg of paintsOf(value, colorOf)) {
          inline.push({ where: `${file}:${line}`, selector: '', fg, grounds });
        }
        return;
      }
      for (const part of selectorsOf(rule)) {
        const [ruleTheme, selector] = themed(part);
        if (ruleTheme && ruleTheme !== theme) continue;
        if (!painted.has(selector)) {
          painted.set(selector, {
            where: `${file}:${line}`,
            fg: new Map(),
            grounds: new Map(),
            rules: new Set(),
          });
        }
        const entry = painted.get(selector);
        if (!entry.rules.has(rule)) {
          entry.rules.add(rule);
          const grounds = backgroundOf(rule, colorOf);
          if (grounds) {
            entry.grounds.set(ruleTheme, [...(entry.grounds.get(ruleTheme) ?? []), ...grounds]);
          }
        }
        if (!isText) continue;
        const uses = entry.fg.get(ruleTheme) ?? [];
        for (const fg of paintsOf(value, colorOf)) uses.push({ where: `${file}:${line}`, fg });
        entry.fg.set(ruleTheme, uses);
      }
    },
  });

  const fgOf = (selector) => {
    const entry = painted.get(selector);
    const own = entry && forTheme(entry.fg, theme);
    if (own) return { own: true, uses: own };
    const base = baseOf(selector);
    return base ? { own: false, uses: fgOf(base).uses } : { own: false, uses: [] };
  };
  // A state's own background replaces its element's; without one it keeps it.
  const groundsOf = (selector) => {
    const entry = painted.get(selector);
    const base = baseOf(selector);
    return (entry && forTheme(entry.grounds, theme)) ?? (base ? groundsOf(base) : null);
  };

  const found = [...inline];
  for (const [selector, entry] of painted) {
    const fg = fgOf(selector);
    // A pseudo-element painting only a ground (a dot, a rule) carries no text.
    if (!fg.own && (!forTheme(entry.grounds, theme) || PART.test(selector))) continue;
    const grounds = groundsOf(selector);
    for (const use of fg.uses) {
      found.push({ where: fg.own ? use.where : entry.where, selector, fg: use.fg, grounds });
    }
  }
  return found.map((use) => ({ ...use, minimum: minimumOf(use) }));
};

// The opaque colours a use's text can sit on: each ground, a translucent one
// composited over each page ground. [ground, colour] pairs.
export const opaqueGrounds = (use, colorOf) =>
  (use.grounds ?? PAGE_GROUNDS).flatMap((ground) => {
    const paint = colorOf(ground);
    if (!paint) return [];
    if (paint[3] === 1) return [[ground, paint]];
    return PAGE_GROUNDS.map((page) => [ground, over(paint, colorOf(page))]);
  });

const worstRatio = (use, colorOf) => {
  let worst = { ratio: Infinity, ground: null };
  for (const [ground, opaque] of opaqueGrounds(use, colorOf)) {
    const ratio = contrast(colorOf(use.fg), opaque);
    if (ratio < worst.ratio) worst = { ratio, ground };
  }
  return worst;
};

const label = (value) => value.replace(/^var\((--[a-z0-9-]+)\)$/, '$1');

// One row per text colour and ground, at its lowest ratio, with every place
// that paints it.
export const measure = (rootDir, themeCss, theme = 'light') => {
  const colorOf = palette(themeCss, theme);
  const rows = new Map();
  for (const use of textUses(rootDir, themeCss, theme)) {
    const { minimum } = use;
    if (minimum === 0 || !colorOf(use.fg)) continue;
    const { ratio, ground } = worstRatio(use, colorOf);
    const key = `${label(use.fg)} on ${use.grounds ? use.grounds.map(label).join(' / ') : 'page'}`;
    const row = rows.get(key) ?? {
      fg: label(use.fg),
      ground: use.grounds ? label(ground) : `page (${label(ground)})`,
      ratio,
      minimum,
      where: [],
    };
    row.ratio = Math.min(row.ratio, ratio);
    row.minimum = Math.max(row.minimum, minimum);
    row.where.push(`${use.where} ${use.selector}`.trim());
    rows.set(key, row);
  }
  for (const pair of ACCENT_PAIRS) {
    rows.set(`${pair.fg} on ${pair.ground}`, {
      ...pair,
      ratio: contrast(colorOf(pair.fg), colorOf(pair.ground)),
      where: [THEME_FILE],
    });
  }
  return [...rows.values()].sort((a, b) => a.ratio - b.ratio);
};

const main = () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const css = fs.readFileSync(path.join(rootDir, THEME_FILE), 'utf8');
  console.log('| Text | Ground | Light | AA | Painted by |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const { fg, ground, ratio, minimum, where } of measure(rootDir, css)) {
    const pass = ratio >= minimum ? 'pass' : 'FAIL';
    const more = where.length > 1 ? ` (+${where.length - 1})` : '';
    console.log(
      `| \`${fg}\` | \`${ground}\` | ${ratio.toFixed(2)} | ${minimum}:1 ${pass} | ${where[0]}${more} |`,
    );
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
