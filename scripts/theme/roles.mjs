// The colour vocabulary as data. A declaration's property gives the role its
// colour plays (text, line, fill, shadow, mask); a token's name gives the kind
// of colour it is (an accent foreground, a solid fill, a translucent wash...).
// The codemod picks the token whose kind fits the role, and the checker fails
// a token whose kind does not. Dark values come from src/theme.css, never from
// here.
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import {
  evaluateColor,
  isChromatic,
  isDarkLettering,
  parseColor,
  sameColor,
  toHex,
} from './colors.mjs';

// Property → the role its colour plays. First match wins.
export const PROPERTY_ROLES = [
  [
    /^(color|caret-color|-webkit-text-fill-color|text-decoration(-color)?|text-emphasis(-color)?|-webkit-text-stroke(-color)?)$/,
    'fg',
  ],
  [/^(border|outline|column-rule)(-[a-z-]+)?$/, 'line'],
  [/^stroke$/, 'line'],
  [
    /^(background(-[a-z-]+)?|fill|stop-color|flood-color|lighting-color|scrollbar-color|accent-color)$/,
    'fill',
  ],
  [/^(box-shadow|text-shadow)$/, 'shadow'],
  [/^(-webkit-)?mask(-[a-z-]+)?$/, 'mask'],
];

// Component-local custom properties that hold a colour, and how their
// consumers paint it.
export const CUSTOM_PROPERTY_ROLES = {
  '--ps-untinted': 'fill',
};

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export const roleOf = (property) => {
  const prop = property.startsWith('--') ? property : kebab(property).toLowerCase();
  if (prop.startsWith('--')) return CUSTOM_PROPERTY_ROLES[prop] ?? null;
  return PROPERTY_ROLES.find(([pattern]) => pattern.test(prop))?.[1] ?? null;
};

// Tailwind utility → role, for arbitrary values such as `bg-[#16130d]`.
export const TAILWIND_ROLES = {
  bg: 'fill',
  from: 'fill',
  via: 'fill',
  to: 'fill',
  fill: 'fill',
  accent: 'fill',
  text: 'fg',
  decoration: 'fg',
  placeholder: 'fg',
  caret: 'fg',
  border: 'line',
  'border-t': 'line',
  'border-r': 'line',
  'border-b': 'line',
  'border-l': 'line',
  'border-x': 'line',
  'border-y': 'line',
  divide: 'line',
  outline: 'line',
  ring: 'line',
  'ring-offset': 'line',
  stroke: 'line',
  shadow: 'shadow',
};

// Translucent paint is a channel times a per-role alpha multiplier. Each
// family names its channel tokens (`--ct-<family>-<fg|bg>-rgb`) and the
// multiplier each side uses. Every multiplier is 1 in dark.
export const FAMILIES = {
  overlay: { fg: '--ct-k-overlay-fg', bg: '--ct-k-overlay-bg' },
  gold: { fg: '--ct-k-accent-fg', bg: '--ct-k-accent-bg' },
  hit: { fg: '--ct-k-accent-fg', bg: '--ct-k-accent-bg' },
  miss: { fg: '--ct-k-accent-fg', bg: '--ct-k-accent-bg' },
  slate: { fg: '--ct-k-accent-fg', bg: '--ct-k-accent-bg' },
  ink: { fg: '--ct-k-ground', bg: '--ct-k-ground' },
  surface: { fg: '--ct-k-ground', bg: '--ct-k-ground' },
  text: { fg: '--ct-k-ground', bg: '--ct-k-ground' },
};

// Foreground accents and the solid fill that replaces each in a fill role.
export const FILL_OF = {
  '--ct-gold': '--ct-gold-fill',
  '--ct-gold-hover': '--ct-gold-fill-hover',
  '--ct-gold-press': '--ct-gold-fill-press',
  '--ct-hit': '--ct-hit-fill',
  '--ct-miss': '--ct-miss-fill',
};

const ALPHA = '(\\d+(?:p\\d+)?|x[0-9a-f]{2})';
const FAMILY = `(${Object.keys(FAMILIES).join('|')})`;
const LADDER_RE = new RegExp(`^--ct-${FAMILY}-(fg|bg)-${ALPHA}$`);
const SHADOW_RE = new RegExp(`^--ct-shadow-${ALPHA}$`);
const SCRIM_RE = new RegExp(`^--ct-scrim-${ALPHA}$`);
// --ct-x-<hex>[-<alpha>][-fill] legacy shades; --ct-on-<hex>[-<alpha>] lettering on a fill.
const TAIL_RE = new RegExp(`^--ct-(x|on)-([0-9a-f]{6})(?:-${ALPHA})?(-fill)?$`);
export const TAIL_NAME_RE = /^--ct-(x|on)-[0-9a-f]{6}/;

// Name → kind for the hand-named tokens in src/theme.css. Generated names
// carry their kind in their shape (see kindOf).
const NAMED_KINDS = [
  [/^--ct-(gold|gold-hover|gold-press|hit|miss|slate)$/, 'accent-fg'],
  [/-fill(-hover|-press)?$/, 'fill'],
  [/^--ct-on-gold$/, 'on-accent'],
  [/^--ct-mask$/, 'mask'],
  [/^--ct-line(-strong)?$/, 'line'],
  [/^--ct-[a-z]+-soft$/, 'ladder-bg'],
  [/^--ct-[a-z]+-fg-rgb$/, 'ladder-fg'],
  [/^--ct-[a-z]+-bg-rgb$/, 'ladder-bg'],
];

// Which token kinds may paint each role. `line` tokens (the hairlines) are
// also drawn as 1px backgrounds; `fill` is a line colour only on a rule that
// paints that same fill (see onAccentContext).
export const ALLOWED_KINDS = {
  fg: new Set(['neutral', 'accent-fg', 'line', 'ladder-fg', 'on-accent', 'other']),
  line: new Set(['neutral', 'accent-fg', 'line', 'ladder-fg', 'other']),
  fill: new Set(['neutral', 'fill', 'line', 'ladder-bg', 'scrim', 'other']),
};

const EPSILON = 1e-9;

// 0.2 → '20', 0.015 → '1p5', 20/255 → 'x14'. Null when neither spelling is exact.
export const alphaName = (alpha) => {
  const percent = alpha * 100;
  const rounded = Math.round(percent * 100) / 100;
  if (Math.abs(rounded - percent) < EPSILON) return String(rounded).replace('.', 'p');
  const byte = Math.round(alpha * 255);
  if (Math.abs(byte / 255 - alpha) < EPSILON) return `x${byte.toString(16).padStart(2, '0')}`;
  return null;
};

// The alpha as a CSS number expression: '0.2', '0.015', '20 / 255'.
const alphaExpression = (name) =>
  name.startsWith('x')
    ? `${parseInt(name.slice(1), 16)} / 255`
    : String(Number(name.replace('p', '.')) / 100);

const alphaValue = (name) =>
  name.startsWith('x') ? parseInt(name.slice(1), 16) / 255 : Number(name.replace('p', '.')) / 100;

// The CSS value of a generated token, derived from its name alone, or null
// when the name is not a generated shape.
export const definitionOf = (name) => {
  let match = name.match(LADDER_RE);
  if (match) {
    const [, family, side, alpha] = match;
    return `rgb(var(--ct-${family}-${side}-rgb) / calc(${alphaExpression(alpha)} * var(${FAMILIES[family][side]})))`;
  }
  match = name.match(SHADOW_RE);
  if (match)
    return `rgb(var(--ct-shadow-rgb) / calc(${alphaExpression(match[1])} * var(--ct-k-shadow)))`;
  match = name.match(SCRIM_RE);
  if (match) return `rgb(var(--ct-scrim-rgb) / ${alphaExpression(match[1])})`;
  match = name.match(TAIL_RE);
  if (match) {
    const [, , hex, alpha] = match;
    if (!alpha) return `#${hex}`;
    if (alpha.startsWith('x')) return `#${hex}${alpha.slice(1)}`;
    const [r, g, b] = hex.match(/../g).map((pair) => parseInt(pair, 16));
    return `rgba(${r}, ${g}, ${b}, ${alphaValue(alpha)})`;
  }
  return null;
};

export const isGenerated = (name) => definitionOf(name) !== null;

// Generated tokens split into plain values (tails, on :root) and channel
// expressions (ladder, re-declared wherever a theme is set).
export const isTail = (name) => TAIL_RE.test(name);

const ROOT_SELECTOR = /^:root(\s*,\s*\[data-theme\])?$/;

// Every --ct-* token src/theme.css declares at the root, with its dark value
// and kind.
export const buildRegistry = (themeCss) => {
  const declared = new Map();
  postcss.parse(themeCss).walkRules((rule) => {
    if (!ROOT_SELECTOR.test(rule.selector.replace(/\s+/g, ' ').trim())) return;
    rule.walkDecls((decl) => {
      if (decl.prop.startsWith('--ct-')) declared.set(decl.prop, decl.value.trim());
    });
  });

  const rawOf = (name) => declared.get(name) ?? definitionOf(name) ?? undefined;
  const darkCache = new Map();
  const dark = (name) => {
    if (!darkCache.has(name)) {
      const raw = rawOf(name);
      darkCache.set(name, raw === undefined ? null : evaluateColor(raw, rawOf));
    }
    return darkCache.get(name);
  };

  const kindOf = (name) => {
    const tail = name.match(TAIL_RE);
    if (tail) {
      if (tail[1] === 'on') return 'on-accent';
      if (tail[4]) return 'fill';
      const rgba = dark(name);
      return rgba && isChromatic(rgba) ? 'accent-fg' : 'neutral';
    }
    const ladder = name.match(LADDER_RE);
    if (ladder) return ladder[2] === 'fg' ? 'ladder-fg' : 'ladder-bg';
    if (SHADOW_RE.test(name)) return 'shadow';
    if (SCRIM_RE.test(name)) return 'scrim';
    const named = NAMED_KINDS.find(([pattern]) => pattern.test(name));
    if (named) return named[1];
    return dark(name) ? 'neutral' : 'other';
  };

  // Hand-named colour tokens, the first choice for an exact dark value.
  const named = [...declared.keys()]
    .filter((name) => !isGenerated(name) && dark(name))
    .map((name) => ({ name, rgba: dark(name), kind: kindOf(name) }));

  const channelOf = (family) => {
    const raw = rawOf(`--ct-${family}-bg-rgb`);
    return raw ? raw.split(/[\s,]+/).map(Number) : null;
  };

  return {
    declared,
    raw: rawOf,
    has: (name) => declared.has(name),
    dark,
    kindOf,
    named,
    families: Object.keys(FAMILIES)
      .map((family) => ({ family, rgb: channelOf(family) }))
      .filter(({ rgb }) => rgb),
    shadowRgb: rawOf('--ct-shadow-rgb')
      ?.split(/[\s,]+/)
      .map(Number),
  };
};

const findNamed = (registry, rgba, kinds) =>
  kinds
    .map((kind) =>
      registry.named.find((token) => token.kind === kind && sameColor(token.rgba, rgba)),
    )
    .find(Boolean)?.name;

const sameRgb = (rgba, rgb) =>
  rgb && rgb.every((channel, i) => Math.abs(channel - rgba[i]) < EPSILON);

// The token a colour should become where it plays `role`. `role` is one of
// fg | line | fill | mask | shadow; a shadow layer passes `blur` so a
// zero-blur ring reads as a line and a soft glow as a wash. `context.fill` is
// the opaque accent this rule paints behind its content, if any.
// Returns { token } or { reason } when no token can say it exactly.
export const tokenFor = (rgba, role, registry, { context = null, blur = 0 } = {}) => {
  const hex = toHex(rgba);
  const opaque = rgba[3] === 1;
  const chromatic = isChromatic(rgba);

  if (role === 'mask') {
    const token = findNamed(registry, rgba, ['mask']);
    return token ? { token } : { reason: 'mask colour other than --ct-mask' };
  }

  if (opaque) {
    const lettering = role === 'fg' && (isDarkLettering(rgba) || (context && !chromatic));
    if (lettering) return { token: findNamed(registry, rgba, ['on-accent']) ?? `--ct-on-${hex}` };
    if (role === 'line' && context && sameColor(context.fill, rgba)) {
      return { token: findNamed(registry, rgba, ['fill']) ?? `--ct-x-${hex}-fill` };
    }
    if (role === 'fill') {
      return {
        token:
          findNamed(registry, rgba, ['fill', 'neutral']) ??
          `--ct-x-${hex}${chromatic ? '-fill' : ''}`,
      };
    }
    return { token: findNamed(registry, rgba, ['accent-fg', 'neutral']) ?? `--ct-x-${hex}` };
  }

  const alpha = alphaName(rgba[3]);
  if (alpha === null) return { reason: 'alpha has no exact name' };
  const side = role === 'fill' || (role === 'shadow' && blur > 0) ? 'bg' : 'fg';

  if (sameRgb(rgba, registry.shadowRgb)) {
    if (role === 'shadow') return { token: `--ct-shadow-${alpha}` };
    if (role === 'fill') return { token: `--ct-scrim-${alpha}` };
    if (role === 'fg') return { token: `--ct-on-${hex}-${alpha}` };
    return { token: `--ct-x-${hex}-${alpha}` };
  }

  const named = findNamed(registry, rgba, side === 'bg' ? ['ladder-bg'] : ['line', 'ladder-fg']);
  if (named) return { token: named };
  const family = registry.families.find(({ rgb }) => sameRgb(rgba, rgb));
  if (family) return { token: `--ct-${family.family}-${side}-${alpha}` };
  if (role === 'fg' && isDarkLettering([...rgba.slice(0, 3), 1])) {
    return { token: `--ct-on-${hex}-${alpha}` };
  }
  return { token: `--ct-x-${hex}-${alpha}${role === 'fill' && chromatic ? '-fill' : ''}` };
};

// Whether a token reference fits its role. Dark lettering tokens (the ink
// grounds) used as text belong on a fill, so they count as misplaced too.
export const misuseOf = (name, role, registry, context = null) => {
  const allowed = ALLOWED_KINDS[role];
  if (!allowed) return null;
  const kind = registry.kindOf(name);
  if (role === 'line' && context && sameColor(context.fill, registry.dark(name))) {
    return kind === 'fill' ? null : `${name} edges the fill it matches; use the fill token`;
  }
  if (!allowed.has(kind)) return `${kind} token ${name} in a ${role} role`;
  if (
    role === 'fg' &&
    kind === 'neutral' &&
    registry.dark(name) &&
    isDarkLettering(registry.dark(name))
  ) {
    return `dark ground ${name} as text; lettering on a fill uses an on-accent token`;
  }
  return null;
};

// The opaque accent a rule paints behind its content: its last background
// that is a single chromatic colour, literal or token.
export const onAccentContext = (rule, registry) => {
  let fill = null;
  rule.each((node) => {
    if (node.type !== 'decl' || !/^background(-color)?$/.test(node.prop)) return;
    const nodes = valueParser(node.value).nodes.filter((n) => n.type !== 'space');
    if (nodes.length !== 1) return;
    const [only] = nodes;
    let rgba = null;
    if (
      only.type === 'function' &&
      only.value === 'var' &&
      only.nodes[0]?.value.startsWith('--ct-')
    ) {
      rgba = registry.dark(only.nodes[0].value);
    } else if (only.type === 'word' || (only.type === 'function' && /^rgba?$/.test(only.value))) {
      rgba = parseColor(valueParser.stringify(only));
    }
    if (rgba && rgba[3] === 1 && isChromatic(rgba)) fill = rgba;
  });
  return fill ? { fill } : null;
};
