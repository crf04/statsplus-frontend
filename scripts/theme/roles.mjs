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
  parseChannels,
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

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

// A custom property has no role of its own; the checker follows it to the
// declarations that paint it.
export const roleOf = (property) => {
  if (property.startsWith('--')) return null;
  const prop = kebab(property).toLowerCase();
  return PROPERTY_ROLES.find(([pattern]) => pattern.test(prop))?.[1] ?? null;
};

// Chart.js options and canvas styles name their colours by suffix:
// pointBackgroundColor, hoverBorderColor, fillStyle, strokeStyle.
const JS_KEY_ROLES = [
  [/BackgroundColor$|^fillStyle$/, 'fill'],
  [/BorderColor$|^strokeStyle$/, 'line'],
  [/Color$/, 'fg'],
];

// The role of a style key, an SVG attribute or a Chart.js/canvas key.
export const jsRoleOf = (key) =>
  roleOf(key) ?? JS_KEY_ROLES.find(([pattern]) => pattern.test(key))?.[1] ?? null;

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

// Tailwind arbitrary colour classes: `hover:border-[#e8a33d]`,
// `bg-[color:var(--ct-gold-fill)]`, `text-[var(--ct-dim)]`. `role` is null for
// a utility that does not paint.
const TAILWIND_RE =
  /(?<![\w-])((?:[a-z-]+:)*)([a-z]+(?:-[a-z]+)*)-\[(color:)?(#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\)|var\((--ct-[a-z0-9-]+)\))\]/g;
export const tailwindColors = (source) =>
  [...source.matchAll(TAILWIND_RE)].map((found) => {
    const [match, variants, utility, hint, value, token] = found;
    return {
      match,
      offset: found.index,
      variants,
      utility,
      hinted: Boolean(hint),
      value,
      token: token ?? null,
      role: TAILWIND_ROLES[utility] ?? null,
    };
  });

// A shadow's layers, each with its blur radius (the third length, 0 if absent).
export const shadowLayers = (nodes) => {
  const layers = [[]];
  for (const node of nodes) {
    if (node.type === 'div' && node.value === ',') layers.push([]);
    else layers.at(-1).push(node);
  }
  return layers.map((layer) => {
    const lengths = layer.filter(
      (node) => node.type === 'word' && /^-?(\d*\.)?\d+([a-z]+)?$/i.test(node.value),
    );
    const blur = lengths[2] ? parseFloat(lengths[2].value) : 0;
    return { nodes: layer, blur };
  });
};

// Translucent paint is a channel times a per-role alpha multiplier. Each
// family names its channel tokens (`--ct-<family>-<side>-rgb`) and the
// multiplier each side uses: `fg` for lines and text, `bg` for washes and
// tints behind content, `fill` for data marks, whose alpha is the same in
// every theme (null: no multiplier). Every multiplier is 1 in dark.
const ACCENT = { fg: '--ct-k-accent-fg', bg: '--ct-k-accent-bg', fill: null };
const SERIES = { fg: '--ct-k-accent-fg', bg: '--ct-k-accent-bg' };
const GROUND = { fg: '--ct-k-ground', bg: '--ct-k-ground' };
export const FAMILIES = {
  overlay: { fg: '--ct-k-overlay-fg', bg: '--ct-k-overlay-bg' },
  gold: ACCENT,
  hit: ACCENT,
  miss: ACCENT,
  slate: SERIES,
  'series-kept': SERIES,
  'series-lead': SERIES,
  'series-dropped': SERIES,
  'series-pink': SERIES,
  ink: GROUND,
  surface: GROUND,
  text: GROUND,
};

// Translucent accent paint at or above this alpha is a data mark (a bar, a
// grade swatch, the strong end of a ramp), not a tint behind content: it takes
// the family's `fill` side, which keeps its alpha in every theme, where a tint
// takes the `bg` multiplier.
export const MARK_ALPHA = 0.5;

const ALPHA = '(\\d+(?:p\\d+)?|x[0-9a-f]{2})';
const FAMILY = `(${Object.keys(FAMILIES).join('|')})`;
const LADDER_RE = new RegExp(`^--ct-${FAMILY}-(fg|bg|fill)-${ALPHA}$`);
const CHANNEL_RE = new RegExp(`^--ct-${FAMILY}-(fg|bg|fill)-rgb$`);
const SHADOW_RE = new RegExp(`^--ct-shadow-${ALPHA}$`);
const SCRIM_RE = new RegExp(`^--ct-scrim-${ALPHA}$`);
// --ct-x-<hex>[-<alpha>][-fill] legacy shades; --ct-on-<hex>[-<alpha>] lettering on a fill.
const TAIL_RE = new RegExp(`^--ct-(x|on)-([0-9a-f]{6})(?:-${ALPHA})?(-fill)?$`);
export const TAIL_NAME_RE = /^--ct-(x|on)-[0-9a-f]{6}/;

const SIDE_KINDS = { fg: 'ladder-fg', bg: 'ladder-bg', fill: 'fill' };

// Name → kind for the hand-named tokens in src/theme.css. Generated names
// carry their kind in their shape (see kindOf).
const NAMED_KINDS = [
  [/^--ct-(gold|gold-hover|gold-press|hit|miss|slate)$/, 'accent-fg'],
  [/-fill(-hover|-press)?$/, 'fill'],
  [/^--ct-on-gold$/, 'on-accent'],
  [/^--ct-mask$/, 'mask'],
  [/^--ct-line(-strong)?$/, 'line'],
  [/^--ct-[a-z]+-soft$/, 'ladder-bg'],
];

// The multiplier an alpha on a channel token must carry, or null when the
// channel keeps its alpha in every theme (marks, scrims).
export const multiplierOf = (channel) => {
  const match = channel.match(CHANNEL_RE);
  if (match) return FAMILIES[match[1]][match[2]] ?? null;
  return channel === '--ct-shadow-rgb' ? '--ct-k-shadow' : null;
};

// Which token kinds may paint each role. A ring is a zero-blur shadow (a
// line drawn outside the box); a shadow has blur. `line` paints a background
// only on a hairline box, `fill` edges only the fill its own rule paints, and
// `on-accent` letters or edges only an accent fill (see misuseOf).
export const ALLOWED_KINDS = {
  fg: new Set(['neutral', 'accent-fg', 'line', 'ladder-fg', 'on-accent', 'other']),
  line: new Set(['neutral', 'accent-fg', 'line', 'ladder-fg', 'other']),
  ring: new Set(['neutral', 'accent-fg', 'line', 'ladder-fg', 'shadow', 'other']),
  fill: new Set(['neutral', 'fill', 'line', 'ladder-bg', 'scrim', 'other']),
  shadow: new Set(['neutral', 'accent-fg', 'ladder-bg', 'shadow', 'other']),
  mask: new Set(['mask', 'other']),
};

// A shadow layer paints a ring without blur and a soft shadow with it.
export const layerRole = (blur) => (blur > 0 ? 'shadow' : 'ring');

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
    const multiplier = FAMILIES[family][side];
    if (multiplier === undefined) return null;
    const channel = `var(--ct-${family}-${side}-rgb)`;
    return multiplier
      ? `rgb(${channel} / calc(${alphaExpression(alpha)} * var(${multiplier})))`
      : `rgb(${channel} / ${alphaExpression(alpha)})`;
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
  // A var() cycle is invalid at computed-value time, so it paints nothing;
  // the checker reports the cycle itself.
  const evaluate = (raw) => {
    try {
      return evaluateColor(raw, rawOf);
    } catch {
      return null;
    }
  };
  const dark = (name) => {
    if (!darkCache.has(name)) {
      const raw = rawOf(name);
      darkCache.set(name, raw === undefined ? null : evaluate(raw));
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
    const ladder = name.match(LADDER_RE) ?? name.match(CHANNEL_RE);
    if (ladder) return SIDE_KINDS[ladder[2]];
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
    return raw ? parseChannels(raw) : null;
  };

  return {
    declared,
    raw: rawOf,
    has: (name) => declared.has(name),
    dark,
    kindOf,
    named,
    families: Object.keys(FAMILIES)
      .map((family) => ({
        family,
        rgb: channelOf(family),
        marks: declared.has(`--ct-${family}-fill-rgb`),
      }))
      .filter(({ rgb }) => rgb),
    shadowRgb: parseChannels(rawOf('--ct-shadow-rgb') ?? ''),
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

const alphaOfName = (name) => {
  const match = name.match(LADDER_RE);
  return match ? { family: match[1], side: match[2], alpha: alphaValue(match[3]) } : null;
};

// The token a colour should become where it plays `role` (fg | line | fill |
// ring | shadow | mask). `context` is what the rule paints behind its content
// (see ruleContext). Returns { token } or { reason } when no token can say it
// exactly.
export const tokenFor = (rgba, role, registry, { context = null } = {}) => {
  const hex = toHex(rgba);
  const opaque = rgba[3] === 1;
  const chromatic = isChromatic(rgba);
  const edgesFill =
    (role === 'line' || role === 'ring') && context?.fills?.some((fill) => sameColor(fill, rgba));

  if (role === 'mask') {
    const token = findNamed(registry, rgba, ['mask']);
    return token ? { token } : { reason: 'mask colour other than --ct-mask' };
  }

  if (opaque) {
    const lettering = role === 'fg' && (isDarkLettering(rgba) || (context?.fills && !chromatic));
    if (lettering) return { token: findNamed(registry, rgba, ['on-accent']) ?? `--ct-on-${hex}` };
    if (edgesFill) return { token: findNamed(registry, rgba, ['fill']) ?? `--ct-x-${hex}-fill` };
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

  if (sameRgb(rgba, registry.shadowRgb)) {
    if (role === 'shadow' || role === 'ring') return { token: `--ct-shadow-${alpha}` };
    if (role === 'fill') return { token: `--ct-scrim-${alpha}` };
    if (role === 'fg') return { token: `--ct-on-${hex}-${alpha}` };
    return { token: `--ct-x-${hex}-${alpha}` };
  }

  const family = registry.families.find(({ rgb }) => sameRgb(rgba, rgb));
  const mark = role === 'fill' && family?.marks && rgba[3] >= MARK_ALPHA;
  if (mark) return { token: `--ct-${family.family}-fill-${alpha}` };
  const side = role === 'fill' || role === 'shadow' ? 'bg' : 'fg';
  const named = findNamed(registry, rgba, side === 'bg' ? ['ladder-bg'] : ['line', 'ladder-fg']);
  if (named) return { token: named };
  if (family) return { token: `--ct-${family.family}-${side}-${alpha}` };
  if (role === 'fg' && isDarkLettering([...rgba.slice(0, 3), 1])) {
    return { token: `--ct-on-${hex}-${alpha}` };
  }
  return { token: `--ct-x-${hex}-${alpha}${role === 'fill' && chromatic ? '-fill' : ''}` };
};

// Why a token reference does not fit its role, or null when it does.
// `context` is the rule's ruleContext, null where there is no rule (inline
// styles, Tailwind classes).
export const misuseOf = (name, role, registry, context = null) => {
  const allowed = ALLOWED_KINDS[role];
  if (!allowed) return null;
  const kind = registry.kindOf(name);
  const dark = registry.dark(name);
  if ((role === 'line' || role === 'ring') && context?.fills?.some((f) => sameColor(f, dark))) {
    return kind === 'fill' ? null : `${name} edges the fill it matches; use the fill token`;
  }
  // A white ring on a coloured avatar keeps its value on any page ground.
  if ((role === 'line' || role === 'ring') && kind === 'on-accent' && context?.fills) return null;
  if (!allowed.has(kind)) return `${kind} token ${name} in a ${role} role`;
  if (role === 'fill') {
    const ladder = alphaOfName(name);
    if (
      ladder &&
      ladder.side === 'bg' &&
      ladder.alpha >= MARK_ALPHA &&
      FAMILIES[ladder.family].fill === null
    ) {
      return `${name} paints a mark (alpha ${MARK_ALPHA} and up); use --ct-${ladder.family}-fill-*`;
    }
    if (ladder && ladder.side === 'fill' && ladder.alpha < MARK_ALPHA) {
      return `${name} paints a tint (alpha under ${MARK_ALPHA}); use --ct-${ladder.family}-bg-*`;
    }
    if (kind === 'line' && !context?.hairline) {
      return `line token ${name} as a background; only a hairline box (1px wide, tall or gapped) paints one`;
    }
  }
  if (role === 'fg') {
    if (kind === 'on-accent' && context?.ground) {
      return `on-accent token ${name} on a rule whose background is not an accent fill`;
    }
    if (kind === 'neutral' && dark && isDarkLettering(dark)) {
      return `dark ground ${name} as text; lettering on a fill uses an on-accent token`;
    }
    if (kind === 'neutral' && context?.fills) {
      return `page text ${name} on an accent fill; lettering on a fill uses an on-accent token`;
    }
  }
  return null;
};

// The colours one background value paints: every literal and --ct-* token in
// it, or null when it names none (none, url(), a component variable).
const paintsOf = (value, registry) => {
  const colors = [];
  valueParser(value).walk((node) => {
    if (node.type === 'function' && node.value === 'var') {
      const rgba = registry.dark(node.nodes[0]?.value ?? '');
      if (rgba) colors.push(rgba);
      return false;
    }
    if (node.type === 'function' && /^rgba?$/.test(node.value)) {
      const rgba = parseColor(valueParser.stringify(node));
      if (rgba) colors.push(rgba);
      return false;
    }
    if (node.type === 'word') {
      const rgba = parseColor(node.value);
      if (rgba) colors.push(rgba);
    }
    return undefined;
  });
  return colors.length ? colors : null;
};

const HAIRLINE_PROPS = /^(width|height|min-width|min-height|gap|row-gap|column-gap)$/;

// What a rule paints behind its content, from its last background that names
// a colour. `fills`: the opaque accent colours of a single accent or of a
// gradient whose stops are all opaque accents; `ground`: true when that
// background has a neutral in it (a page or card ground); `hairline`: the rule draws a box at most 1px
// across (or a 1px grid gap), so a line colour may paint its background.
export const ruleContext = (rule, registry) => {
  let paints = null;
  let hairline = false;
  rule.each((node) => {
    if (node.type !== 'decl') return;
    if (/^background(-color|-image)?$/.test(node.prop)) {
      if (/^(none|transparent)$/.test(node.value.trim())) paints = null;
      else paints = paintsOf(node.value, registry) ?? paints;
    } else if (HAIRLINE_PROPS.test(node.prop)) {
      const length = node.value.trim().match(/^(\d*\.?\d+)px$/);
      if (length && Number(length[1]) <= 1) hairline = true;
    }
  });
  return {
    fills: paints?.every((rgba) => rgba[3] === 1 && isChromatic(rgba)) ? paints : null,
    ground: Boolean(paints?.some((rgba) => !isChromatic(rgba))),
    hairline,
  };
};
