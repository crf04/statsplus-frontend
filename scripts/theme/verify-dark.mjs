#!/usr/bin/env node
// Proves a tokenization left dark unchanged, declaration by declaration.
// Every stylesheet and Tailwind colour class that differs from the base
// revision is compared with each --ct-* token replaced by its dark value
// (channels times multipliers, all 1 in dark) and every colour normalised to
// rgba. Component-local custom properties stay symbolic on both sides.
//
//   node scripts/theme/verify-dark.mjs --base origin/master
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import {
  HEX_RE,
  foldCalc,
  formatRgba,
  parseChannels,
  parseColor,
  substituteVars,
} from './colors.mjs';
import { buildRegistry, tailwindColors } from './roles.mjs';
import { THEME_FILE, isStylesheet, isTestFile } from './sources.mjs';

// The value as the browser would paint it in dark, in one canonical spelling.
export const normalize = (value, registry) => {
  const substituted = substituteVars(
    value,
    (name) => (name.startsWith('--ct-') ? registry.raw(name) : undefined),
    { fallbacks: false },
  );
  const folded = foldCalc(substituted);
  const channels = parseChannels(folded);
  if (channels) return channels.join(' ');
  const parsed = valueParser(folded);
  parsed.walk((node) => {
    if (node.type === 'word' && (HEX_RE.test(node.value) || /^(white|black)$/i.test(node.value))) {
      node.value = formatRgba(parseColor(node.value));
      return undefined;
    }
    if (node.type !== 'function' || !/^rgba?$/i.test(node.value)) return undefined;
    const rgba = parseColor(valueParser.stringify(node));
    const parts = node.nodes
      .filter((child) => child.type !== 'div' && child.type !== 'space')
      .map((child) => valueParser.stringify(child));
    node.type = 'word';
    // rgba(var(--oc), 0.16) and rgb(var(--oc) / 0.16) paint the same colour.
    node.value = rgba
      ? formatRgba(rgba)
      : `rgb(${parts.slice(0, -1).join(' ')}${parts.length > 1 ? ' / ' : ''}${parts.at(-1)})`;
    delete node.nodes;
    return false;
  });
  return valueParser
    .stringify(parsed)
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
};

// A selector pinned to dark (`[data-theme='dark']`) paints in dark exactly
// what the root does, so a rule that adds one to its list keeps its scope. A
// rule that applies only under another theme, or while a theme switches,
// paints nothing in dark.
const DARK_PIN = /^\[data-theme=['"]?dark['"]?\]$/;
const OFF_DARK = /\[data-theme=['"]?(?!dark['"]?\])[\w-]+['"]?\]|\[data-theme-switching\]/;
const selectorsOf = (rule) =>
  rule.selector.split(',').map((part) => part.trim().replace(/\s+/g, ' '));
const paintsDark = (decl) => {
  for (let node = decl.parent; node && node.type !== 'root'; node = node.parent) {
    if (node.type === 'rule' && selectorsOf(node).every((part) => OFF_DARK.test(part)))
      return false;
  }
  return true;
};

const scopeOf = (decl) => {
  const scope = [];
  for (let node = decl.parent; node && node.type !== 'root'; node = node.parent) {
    scope.unshift(
      node.type === 'rule'
        ? selectorsOf(node)
            .filter((part) => !DARK_PIN.test(part) && !OFF_DARK.test(part))
            .join(', ')
        : `@${node.name} ${node.params}`,
    );
  }
  return scope.join(' > ').replace(/\s+/g, ' ');
};

// Every declaration in source order, keyed by its rule and its place among
// that rule's declarations of the same property.
const declarations = (css) => {
  const list = [];
  const seen = new Map();
  postcss.parse(css).walkDecls((decl) => {
    if (!paintsDark(decl)) return;
    const base = `${scopeOf(decl)} { ${decl.prop}`;
    const index = seen.get(base) ?? 0;
    seen.set(base, index + 1);
    list.push({ key: `${base} #${index}`, decl });
  });
  return list;
};

const value = (decl) => `${decl.value}${decl.important ? ' !important' : ''}`;

// A component custom property (`--oc`, `--rr-v`) is a name for a colour some
// other rule paints. Each rule that sets it gives its consumers one value.
const isAlias = (prop) => prop.startsWith('--') && !prop.startsWith('--ct-');
const aliasesOf = (css) => {
  const aliases = new Map();
  postcss.parse(css).walkDecls((decl) => {
    if (!isAlias(decl.prop)) return;
    if (!aliases.has(decl.prop)) aliases.set(decl.prop, new Map());
    aliases.get(decl.prop).set(scopeOf(decl), decl.value.trim());
  });
  return aliases;
};

// The value as it paints under the rule `scope` sets aliases in: an alias
// that rule sets takes its value there, one set in a single rule takes that
// value everywhere, any other stays as written.
const resolveAliases = (text, aliases, scope) =>
  substituteVars(
    text,
    (name) => {
      const values = aliases.get(name);
      if (!values) return undefined;
      if (values.has(scope)) return values.get(scope);
      return values.size === 1 ? [...values.values()][0] : undefined;
    },
    { fallbacks: false },
  );

const aliasReads = (text) => [...text.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);

const aliasScopes = (text, aliases) => {
  const scopes = new Set();
  for (const name of aliasReads(text)) {
    for (const scope of aliases.get(name)?.keys() ?? []) scopes.add(scope);
  }
  return scopes;
};

const setters = (values) => [...values.keys()].sort().join(', ');

// The aliases whose setters differ between base and head. A setter that
// moved, appeared beside another or went away changes which elements see the
// value, and one removed while head still reads it paints nothing.
const changedAliases = (aliases, headList, file, mismatches) => {
  const read = new Set(headList.flatMap(({ decl }) => aliasReads(decl.value)));
  const changed = new Set();
  for (const name of new Set([...aliases.base.keys(), ...aliases.head.keys()])) {
    const before = aliases.base.get(name);
    const after = aliases.head.get(name);
    const same =
      before &&
      after &&
      before.size === after.size &&
      [...before].every(([scope, text]) => after.get(scope) === text);
    if (same) continue;
    changed.add(name);
    if (before && after && setters(before) !== setters(after)) {
      mismatches.push({
        file,
        key: name,
        base: `set in ${setters(before)}`,
        head: `set in ${setters(after)}`,
      });
    } else if (before && !after && read.has(name)) {
      mismatches.push({
        file,
        key: name,
        base: `set in ${setters(before)}`,
        head: '(removed, still read)',
      });
    }
  }
  return changed;
};

export const compareCss = (baseCss, headCss, file, baseRegistry, headRegistry) => {
  const mismatches = [];
  const headList = declarations(headCss);
  const head = new Map(headList.map((entry, position) => [entry.key, { ...entry, position }]));
  const aliases = { base: aliasesOf(baseCss), head: aliasesOf(headCss) };
  const changed = changedAliases(aliases, headList, file, mismatches);
  let compared = 0;
  let rewritten = 0;
  let lastPosition = -1;
  for (const { key, decl } of declarations(baseCss)) {
    const other = head.get(key);
    head.delete(key);
    if (!other) {
      // An alias may be renamed or split; its consumers and changedAliases
      // prove the paint.
      if (!isAlias(decl.prop)) mismatches.push({ file, key, base: value(decl), head: '(removed)' });
      continue;
    }
    compared += 1;
    // The cascade takes the later of two declarations, so order is paint.
    if (other.position < lastPosition) {
      mismatches.push({ file, key, base: 'in source order', head: '(moved earlier)' });
    }
    lastPosition = Math.max(lastPosition, other.position);
    const before = value(decl);
    const after = value(other.decl);
    // An unchanged declaration still paints differently when an alias it
    // reads has new setters.
    if (before === after && !aliasReads(after).some((name) => changed.has(name))) continue;
    if (before !== after) rewritten += 1;
    const scopes = new Set([
      ...aliasScopes(before, aliases.base),
      ...aliasScopes(after, aliases.head),
    ]);
    for (const scope of scopes.size ? scopes : [null]) {
      const painted = [
        normalize(resolveAliases(before, aliases.base, scope), baseRegistry),
        normalize(resolveAliases(after, aliases.head, scope), headRegistry),
      ];
      if (painted[0] !== painted[1]) {
        const where = scope === null ? key : `${key} [${scope}]`;
        mismatches.push({ file, key: where, base: painted[0], head: painted[1] });
      }
    }
  }
  for (const [key, { decl }] of head) {
    // New tokens may only be declared in theme.css, and new aliases only as
    // names their consumers resolve; nothing else may appear.
    if (file === THEME_FILE && decl.prop.startsWith('--ct-')) continue;
    if (isAlias(decl.prop)) continue;
    mismatches.push({ file, key, base: '(absent)', head: value(decl) });
  }
  return { compared, rewritten, mismatches };
};

export const compareTailwind = (baseJs, headJs, file, baseRegistry, headRegistry) => {
  const classes = (source, registry) =>
    tailwindColors(source).map(
      ({ variants, utility, value }) => `${variants}${utility} ${normalize(value, registry)}`,
    );
  const before = classes(baseJs, baseRegistry);
  const after = classes(headJs, headRegistry);
  const mismatches = [];
  const length = Math.max(before.length, after.length);
  for (let i = 0; i < length; i += 1) {
    if (before[i] !== after[i]) {
      mismatches.push({
        file,
        key: `tailwind class ${i}`,
        base: before[i] ?? '(absent)',
        head: after[i] ?? '(absent)',
      });
    }
  }
  return { compared: before.length, rewritten: before.length, mismatches };
};

const main = () => {
  const args = process.argv.slice(2);
  const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/master';
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const git = (...gitArgs) =>
    execFileSync('git', gitArgs, { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const changed = git('diff', '--name-only', base, '--', 'src')
    .split('\n')
    .filter((file) => /\.(css|scss|jsx?)$/.test(file) && !isTestFile(file));
  const baseRegistry = buildRegistry(git('show', `${base}:${THEME_FILE}`));
  const headRegistry = buildRegistry(fs.readFileSync(path.join(rootDir, THEME_FILE), 'utf8'));

  const totals = { files: 0, compared: 0, rewritten: 0, mismatches: [] };
  for (const file of changed) {
    if (!fs.existsSync(path.join(rootDir, file))) continue;
    const headText = fs.readFileSync(path.join(rootDir, file), 'utf8');
    let baseText;
    try {
      baseText = git('show', `${base}:${file}`);
    } catch {
      if (isStylesheet(file))
        totals.mismatches.push({ file, key: '(new stylesheet)', base: '', head: '' });
      continue;
    }
    const compare = isStylesheet(file) ? compareCss : compareTailwind;
    const result = compare(baseText, headText, file, baseRegistry, headRegistry);
    if (!result.compared) continue;
    totals.files += 1;
    totals.compared += result.compared;
    totals.rewritten += result.rewritten;
    totals.mismatches.push(...result.mismatches);
  }

  console.log(
    `verify-dark against ${base} (${git('rev-parse', base).trim()}): ${totals.files} file(s), ` +
      `${totals.compared} declaration(s) or classes compared, ${totals.rewritten} rewritten, ` +
      `${totals.mismatches.length} mismatch(es).`,
  );
  for (const { file, key, base: before, head } of totals.mismatches) {
    console.log(`  ${file}  ${key}\n    base: ${before}\n    head: ${head}`);
  }
  if (totals.mismatches.length) process.exitCode = 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
