#!/usr/bin/env node
// Fails on colour that bypasses the theme: a raw colour in src/ outside
// src/theme.css and the allowlist, a var(--ct-*) that src/theme.css does not
// define, a token whose kind does not fit its role (a text accent as a fill,
// a fill as text), and more legacy-shade tokens than the recorded baseline.
// `npm run lint` runs it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseJs } from '@babel/parser';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { COLOR_FUNCTION_RE, CSS_COLOR_NAMES, HEX_RE, parseChannels } from './colors.mjs';
import {
  TAIL_NAME_RE,
  buildRegistry,
  misuseOf,
  onAccentContext,
  roleOf,
  tailwindColors,
} from './roles.mjs';
import { THEME_FILE, TOKEN_REFERENCE_RE, isStylesheet, sourceFiles } from './sources.mjs';

export const ALLOWLIST_FILE = 'scripts/theme/color-allowlist.json';

const rawColorsInValue = (value, role) => {
  const found = [];
  valueParser(value).walk((node) => {
    if (node.type === 'function' && node.value === 'url') {
      const match = valueParser.stringify(node).match(/%23[0-9a-f]{3,8}/i);
      if (match) found.push(match[0]);
      return false;
    }
    if (node.type === 'function' && COLOR_FUNCTION_RE.test(node.value)) {
      const channels = node.nodes.filter((child) => child.type === 'word');
      // rgb(var(--ct-hit-bg-rgb) / 0.4) builds a colour from a token channel.
      const literal = channels.some(
        (child) => /^\d/.test(child.value) && child !== channels.at(-1),
      );
      const fromToken = node.nodes.some(
        (child) => child.type === 'function' && child.value === 'var',
      );
      if (literal || !fromToken) found.push(valueParser.stringify(node));
      return false;
    }
    if (node.type === 'word' && HEX_RE.test(node.value)) found.push(node.value);
    else if (node.type === 'word' && role && CSS_COLOR_NAMES.has(node.value.toLowerCase())) {
      found.push(node.value);
    }
    return undefined;
  });
  return found;
};

const tokenRefs = (value) => {
  const refs = [];
  valueParser(value).walk((node) => {
    if (
      node.type === 'function' &&
      node.value === 'var' &&
      node.nodes[0]?.value.startsWith('--ct-')
    ) {
      refs.push(node.nodes[0].value);
    }
  });
  return refs;
};

export const checkCss = (css, file, registry, defined = registry.declared) => {
  const issues = [];
  const isTheme = file === THEME_FILE;
  postcss.parse(css, { from: file }).walkDecls((decl) => {
    const line = decl.source?.start?.line;
    const where = { file, line, text: `${decl.prop}: ${decl.value}` };
    if (isTheme && decl.prop.startsWith('--ct-')) return;
    const role = roleOf(decl.prop);
    if (!isTheme) {
      for (const raw of rawColorsInValue(decl.value, role)) {
        issues.push({ ...where, rule: 'raw-colour', message: `raw colour ${raw}` });
      }
      if (decl.prop.startsWith('--') && parseChannels(decl.value)) {
        issues.push({ ...where, rule: 'raw-colour', message: `raw colour channels ${decl.value}` });
      }
    }
    const context = decl.parent?.type === 'rule' ? onAccentContext(decl.parent, registry) : null;
    for (const name of tokenRefs(decl.value)) {
      if (!defined.has(name)) {
        issues.push({
          ...where,
          rule: 'unknown-token',
          message: `${name} is not defined in ${THEME_FILE}`,
        });
      } else if (role && registry.has(name)) {
        const misuse = misuseOf(name, role, registry, context);
        if (misuse) issues.push({ ...where, rule: 'role-misuse', message: misuse });
      }
    }
  });
  return issues;
};

const JS_HEX = /(^|[\s'"`([,:{=])(#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4}))(?![\w-])/gi;
const JS_FUNCTION = /\b(rgba?|hsla?)\(\s*(?!var\()/gi;

// A bare word such as 'white' is a colour only where it paints (a style value
// or a paint attribute); elsewhere it is a prop value like closeVariant="white".
const rawColorsInString = (text, painted) => {
  const found = [...text.matchAll(JS_HEX)].map((match) => match[2]);
  found.push(...[...text.matchAll(JS_FUNCTION)].map((match) => `${match[1]}(`));
  if (painted && CSS_COLOR_NAMES.has(text.trim().toLowerCase())) found.push(text.trim());
  return found;
};

const visit = (node, enter, parent = null) => {
  if (!node || typeof node.type !== 'string') return;
  enter(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach((item) => visit(item, enter, node));
    else if (child && typeof child.type === 'string') visit(child, enter, node);
  }
};

// The CSS property a string paints when it is a style value or an SVG paint
// attribute: { background: 'var(--ct-gold)' } or fill="var(--ct-gold)".
const propertyOf = (parent) => {
  let name = null;
  if (parent?.type === 'ObjectProperty' && !parent.computed)
    name = parent.key.name ?? parent.key.value;
  if (parent?.type === 'JSXAttribute') name = parent.name.name;
  return typeof name === 'string' ? name : null;
};

export const checkJs = (source, file, registry, defined = registry.declared) => {
  const issues = [];
  const ast = parseJs(source, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  visit(ast.program, (node, parent) => {
    let text = null;
    if (node.type === 'StringLiteral') text = node.value;
    else if (node.type === 'TemplateElement') text = node.value.cooked ?? node.value.raw;
    else if (node.type === 'JSXText') return;
    if (text === null) return;
    const where = { file, line: node.loc?.start.line, text: text.trim().slice(0, 120) };
    const property = propertyOf(parent);
    const role = property && roleOf(property);
    for (const raw of rawColorsInString(text, Boolean(role))) {
      issues.push({ ...where, rule: 'raw-colour', message: `raw colour ${raw}` });
    }
    for (const name of text.match(TOKEN_REFERENCE_RE) ?? []) {
      if (!defined.has(name)) {
        issues.push({
          ...where,
          rule: 'unknown-token',
          message: `${name} is not defined in ${THEME_FILE}`,
        });
      }
    }
    if (role) {
      for (const name of tokenRefs(text)) {
        const misuse = registry.has(name) && misuseOf(name, role, registry);
        if (misuse) issues.push({ ...where, rule: 'role-misuse', message: misuse });
      }
    }
    for (const { role: utilityRole, token } of tailwindColors(text)) {
      const misuse =
        utilityRole && token && registry.has(token) && misuseOf(token, utilityRole, registry);
      if (misuse) issues.push({ ...where, rule: 'role-misuse', message: misuse });
    }
  });
  return issues;
};

const allowed = (issue, entries, used) => {
  if (issue.rule !== 'raw-colour') return false;
  const index = entries.findIndex(
    (entry) => entry.path === issue.file && (!entry.match || issue.text.includes(entry.match)),
  );
  if (index === -1) return false;
  used.add(index);
  return true;
};

export const check = (rootDir) => {
  const read = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');
  const registry = buildRegistry(read(THEME_FILE));
  const allowlist = JSON.parse(read(ALLOWLIST_FILE));
  const files = sourceFiles(rootDir);
  // Colour tokens live in theme.css; a few layout tokens (--ct-header-height)
  // are declared beside the component that sets them.
  const defined = new Set(registry.declared.keys());
  for (const file of files.filter((name) => name.endsWith('.css'))) {
    postcss.parse(read(file)).walkDecls(/^--ct-/, (decl) => defined.add(decl.prop));
  }
  const issues = [];
  for (const file of files) {
    if (isStylesheet(file)) issues.push(...checkCss(read(file), file, registry, defined));
    else issues.push(...checkJs(read(file), file, registry, defined));
  }

  const used = new Set();
  const failures = issues.filter((issue) => !allowed(issue, allowlist.entries, used));
  allowlist.entries.forEach((entry, index) => {
    if (!used.has(index)) {
      failures.push({
        file: ALLOWLIST_FILE,
        rule: 'stale-allowlist',
        message: `nothing in ${entry.path} matches ${entry.match ?? 'the entry'}; remove it`,
      });
    }
  });

  const tails = [...registry.declared.keys()].filter((name) => TAIL_NAME_RE.test(name)).length;
  if (tails > allowlist.tailBaseline) {
    failures.push({
      file: THEME_FILE,
      rule: 'tail-ratchet',
      message: `${tails} legacy-shade tokens (--ct-x-*, --ct-on-<hex>) exceed the baseline of ${allowlist.tailBaseline}; use a named token`,
    });
  }
  return { failures, tails, baseline: allowlist.tailBaseline };
};

const main = () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const { failures, tails, baseline } = check(rootDir);
  for (const { file, line, rule, message } of failures) {
    console.error(`${file}${line ? `:${line}` : ''}  ${rule}  ${message}`);
  }
  if (tails < baseline) {
    console.log(`Legacy-shade tokens fell to ${tails}; lower tailBaseline in ${ALLOWLIST_FILE}.`);
  }
  if (failures.length) {
    console.error(`\ncheck-colors: ${failures.length} problem(s). See scripts/theme/README.md.`);
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
