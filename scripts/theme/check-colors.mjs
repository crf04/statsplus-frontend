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
  jsRoleOf,
  layerRole,
  misuseOf,
  multiplierOf,
  roleOf,
  ruleContext,
  shadowLayers,
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

const refsIn = (nodes) => {
  const refs = [];
  valueParser.walk(nodes, (node) => {
    if (node.type === 'function' && node.value === 'var' && node.nodes[0]?.value.startsWith('--')) {
      refs.push(node.nodes[0].value);
    }
  });
  return refs;
};
const tokenRefs = (value) =>
  refsIn(valueParser(value).nodes).filter((name) => name.startsWith('--ct-'));

// Each token reference with the role it paints in: a shadow's layers are
// rings or soft shadows by their blur.
const paintedRefs = (value, role) => {
  const nodes = valueParser(value).nodes;
  const layers = role === 'shadow' ? shadowLayers(nodes) : [{ nodes, blur: null }];
  return layers.flatMap((layer) =>
    refsIn(layer.nodes)
      .filter((name) => name.startsWith('--ct-'))
      .map((name) => ({ name, role: layer.blur === null ? role : layerRole(layer.blur) })),
  );
};

// rgb(var(--ct-gold-bg-rgb) / 0.4) skips the alpha multiplier that makes the
// tint right on light; the alpha must carry it, as the ladder tokens do.
const unscaledChannels = (value) => {
  const found = [];
  valueParser(value).walk((node) => {
    if (node.type !== 'function' || !/^rgba?$/i.test(node.value)) return undefined;
    const [first] = node.nodes.filter((child) => child.type !== 'space');
    const channel =
      first?.type === 'function' && first.value === 'var' ? first.nodes[0]?.value : '';
    const multiplier = channel ? multiplierOf(channel) : null;
    const slash = node.nodes.findIndex((child) => child.type === 'div');
    if (!multiplier || slash === -1) return false;
    const alpha = valueParser.stringify(node.nodes.slice(slash + 1));
    if (!alpha.includes(`var(${multiplier})`)) {
      found.push(`${valueParser.stringify(node)} leaves out ${multiplier}; use a ladder token`);
    }
    return false;
  });
  return found;
};

// A value with each component custom property (`--oc`, `--rr-v`) replaced by
// every value src/ declares for it, so a token reached through one is checked
// where it paints.
const MAX_EXPANSIONS = 64;
const expandAliases = (value, aliases, depth = 0) => {
  if (depth > 8) return [value];
  const parsed = valueParser(value);
  let target = null;
  parsed.walk((node) => {
    if (target || node.type !== 'function' || node.value !== 'var') return undefined;
    if (aliases.has(node.nodes[0]?.value)) target = node;
    return undefined;
  });
  if (!target) return [value];
  const name = target.nodes[0].value;
  return [...aliases.get(name)]
    .flatMap((candidate) => {
      Object.assign(target, { type: 'word', value: candidate });
      return expandAliases(valueParser.stringify(parsed), aliases, depth + 1);
    })
    .slice(0, MAX_EXPANSIONS);
};

// Custom properties declared outside theme.css, with every value given each.
export const aliasesOf = (stylesheets, registry) => {
  const aliases = new Map();
  for (const css of stylesheets) {
    postcss.parse(css).walkDecls(/^--/, (decl) => {
      if (registry.has(decl.prop)) return;
      if (!aliases.has(decl.prop)) aliases.set(decl.prop, new Set());
      aliases.get(decl.prop).add(decl.value.trim());
    });
  }
  return aliases;
};

const issue = (where, rule, message) => ({ ...where, rule, message });

// Problems with one painted value after its aliases are followed: a token in
// the wrong role and a channel alpha without its multiplier.
const paintIssues = (value, role, registry, context, aliases) => {
  const messages = new Set();
  for (const expanded of expandAliases(value, aliases)) {
    for (const message of unscaledChannels(expanded)) messages.add(['multiplier', message]);
    if (!role) continue;
    for (const ref of paintedRefs(expanded, role)) {
      const misuse = registry.has(ref.name) && misuseOf(ref.name, ref.role, registry, context);
      if (misuse) messages.add(['role-misuse', misuse]);
    }
  }
  return [...new Map([...messages].map((entry) => [entry.join(' '), entry])).values()];
};

// Every var() cycle among the tokens a stylesheet declares.
const tokenCycles = (root) => {
  const edges = new Map();
  root.walkDecls(/^--ct-/, (decl) => {
    edges.set(decl.prop, [...(edges.get(decl.prop) ?? []), ...tokenRefs(decl.value)]);
  });
  const cycles = [];
  const state = new Map();
  const visit = (name, trail) => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'open') {
      cycles.push(trail.slice(trail.indexOf(name)).concat(name));
      return;
    }
    state.set(name, 'open');
    for (const next of edges.get(name) ?? []) visit(next, [...trail, name]);
    state.set(name, 'done');
  };
  for (const name of edges.keys()) visit(name, []);
  return cycles;
};

export const checkCss = (css, file, registry, scope = {}) => {
  const { defined = registry.declared, aliases = aliasesOf([css], registry) } = scope;
  const issues = [];
  const isTheme = file === THEME_FILE;
  const root = postcss.parse(css, { from: file });
  root.walkDecls((decl) => {
    const line = decl.source?.start?.line;
    const where = { file, line, text: `${decl.prop}: ${decl.value}` };
    for (const name of tokenRefs(decl.value)) {
      if (!defined.has(name)) {
        issues.push(issue(where, 'unknown-token', `${name} is not defined in ${THEME_FILE}`));
      }
    }
    // theme.css defines the palette: its token values are the raw colours.
    if (isTheme && decl.prop.startsWith('--')) return;
    const role = roleOf(decl.prop);
    for (const raw of rawColorsInValue(decl.value, role)) {
      issues.push(issue(where, 'raw-colour', `raw colour ${raw}`));
    }
    if (decl.prop.startsWith('--') && parseChannels(decl.value)) {
      issues.push(issue(where, 'raw-colour', `raw colour channels ${decl.value}`));
    }
    const context = decl.parent?.type === 'rule' ? ruleContext(decl.parent, registry) : null;
    for (const [rule, message] of paintIssues(decl.value, role, registry, context, aliases)) {
      issues.push(issue(where, rule, message));
    }
  });
  if (isTheme) {
    for (const cycle of tokenCycles(root)) {
      issues.push({ file, rule: 'token-cycle', message: `var() cycle ${cycle.join(' → ')}` });
    }
  }
  return issues;
};

const JS_HEX = /(^|[\s'"`([,:{=])(#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4}))(?![\w-])/gi;
const JS_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*(?!var\()/gi;

// A string that does not paint (a class name, a label) holds a colour only
// as a hex or a colour function; a bare word there is a prop value such as
// closeVariant="white".
const rawColorsInText = (text) => [
  ...[...text.matchAll(JS_HEX)].map((match) => match[2]),
  ...[...text.matchAll(JS_FUNCTION)].map((match) => `${match[1]}(`),
];

const visit = (node, enter, ancestors = []) => {
  if (!node || typeof node.type !== 'string') return;
  enter(node, ancestors);
  const inner = [...ancestors, node];
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach((item) => visit(item, enter, inner));
    else if (child && typeof child.type === 'string') visit(child, enter, inner);
  }
};

// Expressions a painted string passes through on its way to the property.
const PASS_THROUGH = new Set([
  'ConditionalExpression',
  'LogicalExpression',
  'JSXExpressionContainer',
  'TemplateLiteral',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'ParenthesizedExpression',
  'BinaryExpression',
]);

const keyName = (key) => key?.name ?? (typeof key?.value === 'string' ? key.value : null);

// The property a string ends up painting: a style key, an SVG paint attribute,
// a Chart.js option or a canvas style, through conditionals, fallbacks and
// template literals, with the object that holds a style key. Null when the
// string is not a value of one.
const paintedProperty = (node, ancestors) => {
  let child = node;
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const parent = ancestors[i];
    if (parent.type === 'ObjectProperty') {
      if (parent.value !== child || parent.computed) return null;
      return { name: keyName(parent.key), style: ancestors[i - 1] };
    }
    if (parent.type === 'JSXAttribute') return { name: parent.name.name };
    if (parent.type === 'AssignmentExpression') {
      const target = parent.left;
      return parent.right === child && target.type === 'MemberExpression' && !target.computed
        ? { name: keyName(target.property) }
        : null;
    }
    if (!PASS_THROUGH.has(parent.type)) return null;
    if (parent.type === 'BinaryExpression' && parent.operator !== '+') return null;
    child = parent;
  }
  return null;
};

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const literalText = (value) => {
  if (value?.type === 'StringLiteral') return value.value;
  if (value?.type === 'TemplateLiteral') {
    return value.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(TEMPLATE_HOLE);
  }
  return null;
};

// What an inline style object paints behind its content, read like a rule.
const styleContext = (style, registry) => {
  if (style?.type !== 'ObjectExpression') return null;
  const decls = style.properties.flatMap((property) => {
    const name = property.type === 'ObjectProperty' && !property.computed && keyName(property.key);
    const text = name && literalText(property.value);
    return text === null || !name ? [] : [`${kebab(name)}: ${text};`];
  });
  return ruleContext(postcss.parse(`x { ${decls.join(' ')} }`).first, registry);
};

// Attributes whose '#abc' is a fragment or an id, never a colour.
const NOT_PAINT = new Set(['href', 'id', 'to', 'htmlFor']);

// A template literal reads as one value, each ${} standing in as a number.
const TEMPLATE_HOLE = '1';

export const checkJs = (source, file, registry, scope = {}) => {
  const { defined = registry.declared } = scope;
  const issues = [];
  const ast = parseJs(source, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  visit(ast.program, (node, ancestors) => {
    let pieces;
    if (node.type === 'StringLiteral') pieces = [node.value];
    else if (node.type === 'TemplateLiteral') {
      pieces = node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw);
    } else return;
    const text = pieces.join(TEMPLATE_HOLE);
    const property = paintedProperty(node, ancestors);
    if (NOT_PAINT.has(property?.name)) return;
    const role = property?.name ? jsRoleOf(property.name) : null;
    const context = role ? styleContext(property.style, registry) : null;
    const where = { file, line: node.loc?.start.line, text: text.trim().slice(0, 120) };
    const raws = role ? rawColorsInValue(text, role) : rawColorsInText(text);
    for (const raw of raws) issues.push(issue(where, 'raw-colour', `raw colour ${raw}`));
    // A name cut by a ${} (`--ct-${family}-bg-rgb`) is built at runtime.
    const names = pieces.flatMap((piece, i) =>
      [...piece.matchAll(TOKEN_REFERENCE_RE)]
        .filter(
          (match) =>
            i === pieces.length - 1 || !/^-?$/.test(piece.slice(match.index + match[0].length)),
        )
        .map((match) => match[0]),
    );
    for (const name of names) {
      if (!defined.has(name)) {
        issues.push(issue(where, 'unknown-token', `${name} is not defined in ${THEME_FILE}`));
      }
    }
    for (const [rule, message] of paintIssues(text, role, registry, context, new Map())) {
      issues.push(issue(where, rule, message));
    }
    for (const { role: utilityRole, token } of tailwindColors(text)) {
      const misuse =
        utilityRole && token && registry.has(token) && misuseOf(token, utilityRole, registry);
      if (misuse) issues.push(issue(where, 'role-misuse', misuse));
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
  const stylesheets = files.filter((file) => isStylesheet(file) && file !== THEME_FILE);
  const scope = { defined, aliases: aliasesOf(stylesheets.map(read), registry) };
  const issues = [];
  for (const file of files) {
    if (isStylesheet(file)) issues.push(...checkCss(read(file), file, registry, scope));
    else issues.push(...checkJs(read(file), file, registry, scope));
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
