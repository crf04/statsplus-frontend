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
import { HEX_RE, foldCalc, formatRgba, parseColor, substituteVars } from './colors.mjs';
import { buildRegistry } from './roles.mjs';
import { THEME_FILE } from './tokenize.mjs';

const CHANNELS =
  /^\s*(\d+(?:\.\d+)?)\s*,?\s+(\d+(?:\.\d+)?)\s*,?\s+(\d+(?:\.\d+)?)\s*$|^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/;

// The value as the browser would paint it in dark, in one canonical spelling.
export const normalize = (value, registry) => {
  const substituted = substituteVars(
    value,
    (name) => (name.startsWith('--ct-') ? registry.raw(name) : undefined),
    { fallbacks: false },
  );
  const folded = foldCalc(substituted);
  const channels = folded.match(CHANNELS);
  if (channels) return channels.filter(Boolean).slice(1).map(Number).join(' ');
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

const declarations = (css) => {
  const list = [];
  const seen = new Map();
  postcss.parse(css).walkDecls((decl) => {
    const scope = [];
    for (let node = decl.parent; node && node.type !== 'root'; node = node.parent) {
      scope.unshift(node.type === 'rule' ? node.selector : `@${node.name} ${node.params}`);
    }
    const base = `${scope.join(' > ').replace(/\s+/g, ' ')} { ${decl.prop}`;
    const index = seen.get(base) ?? 0;
    seen.set(base, index + 1);
    list.push({ key: `${base} #${index}`, decl });
  });
  return list;
};

const value = (decl) => `${decl.value}${decl.important ? ' !important' : ''}`;

export const compareCss = (baseCss, headCss, file, baseRegistry, headRegistry) => {
  const mismatches = [];
  const head = new Map(declarations(headCss).map((entry) => [entry.key, entry.decl]));
  let compared = 0;
  let rewritten = 0;
  for (const { key, decl } of declarations(baseCss)) {
    const other = head.get(key);
    head.delete(key);
    if (!other) {
      mismatches.push({ file, key, base: value(decl), head: '(removed)' });
      continue;
    }
    compared += 1;
    if (value(decl) === value(other)) continue;
    rewritten += 1;
    const before = normalize(value(decl), baseRegistry);
    const after = normalize(value(other), headRegistry);
    if (before !== after) mismatches.push({ file, key, base: before, head: after });
  }
  for (const [key, decl] of head) {
    // New tokens may only be declared in theme.css; nothing else may appear.
    if (file === THEME_FILE && decl.prop.startsWith('--ct-')) continue;
    mismatches.push({ file, key, base: '(absent)', head: value(decl) });
  }
  return { compared, rewritten, mismatches };
};

const TAILWIND_COLOR =
  /(?<![\w-])((?:[a-z-]+:)*[a-z]+(?:-[a-z]+)*)-\[(?:color:)?(#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\)|var\(--ct-[a-z0-9-]+\))\]/g;

export const compareTailwind = (baseJs, headJs, file, baseRegistry, headRegistry) => {
  const classes = (source, registry) =>
    [...source.matchAll(TAILWIND_COLOR)].map(
      ([, utility, color]) => `${utility} ${normalize(color, registry)}`,
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
    .filter((file) => /\.(css|scss|jsx?)$/.test(file) && !/\.test\.jsx?$/.test(file));
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
      if (/\.(css|scss)$/.test(file))
        totals.mismatches.push({ file, key: '(new stylesheet)', base: '', head: '' });
      continue;
    }
    const compare = /\.(css|scss)$/.test(file) ? compareCss : compareTailwind;
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
