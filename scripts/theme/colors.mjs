// Colour values as data: parse a CSS colour literal to [r, g, b, a], and
// evaluate a token expression (var() substitution, calc() arithmetic) to the
// colour it paints. Shared by the codemod, the checker and the dark-parity
// verifier so all three read a colour the same way.
import valueParser from 'postcss-value-parser';

const NAMED_VALUES = {
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
};

// Every CSS named colour, for detection only. `transparent` and
// `currentcolor` are deliberately absent: they never carry a palette value.
export const CSS_COLOR_NAMES = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
    'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
    'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
    'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
    'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
    'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
    'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);

export const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Functions that build a colour from channels.
export const COLOR_FUNCTION_RE = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)$/i;

// A colour as bare channels, '232 163 61' or '232, 163, 61', as a channel
// token or a component custom property holds it for rgb(var(--x) / a).
const CHANNEL_TRIPLE_RE =
  /^\s*(\d+(?:\.\d+)?)(?:\s*,\s*|\s+)(\d+(?:\.\d+)?)(?:\s*,\s*|\s+)(\d+(?:\.\d+)?)\s*$/;
export const parseChannels = (text) => text.match(CHANNEL_TRIPLE_RE)?.slice(1).map(Number) ?? null;

const EPSILON = 1e-9;

export const sameColor = (a, b) =>
  Boolean(a && b) && a.every((channel, i) => Math.abs(channel - b[i]) < EPSILON);

const parseHex = (hex) => {
  let digits = hex.slice(1).toLowerCase();
  if (digits.length <= 4) digits = [...digits].map((d) => d + d).join('');
  const bytes = digits.match(/../g).map((pair) => parseInt(pair, 16));
  return [bytes[0], bytes[1], bytes[2], bytes.length === 4 ? bytes[3] / 255 : 1];
};

const channelNumber = (text, scale) => {
  const value = text.trim();
  if (value.endsWith('%')) return (parseFloat(value) / 100) * scale;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// rgb()/rgba() arguments in either the comma or the space-and-slash syntax.
const parseRgbArgs = (args) => {
  const parts = args
    .replace(/\//g, ' / ')
    .split(/[\s,]+/)
    .filter(Boolean);
  const slash = parts.indexOf('/');
  const channels = slash === -1 ? parts : parts.slice(0, slash);
  const alphaText = slash === -1 ? channels[3] : parts[slash + 1];
  if (channels.length < 3) return null;
  const rgb = channels.slice(0, 3).map((part) => channelNumber(part, 255));
  const alpha = alphaText === undefined ? 1 : channelNumber(alphaText, 1);
  if (rgb.some((channel) => channel === null) || alpha === null) return null;
  return [...rgb, alpha];
};

// [r, g, b, a] for a plain colour literal, or null for anything else.
export const parseColor = (text) => {
  const value = text.trim().toLowerCase();
  if (HEX_RE.test(value)) return parseHex(value);
  if (NAMED_VALUES[value]) return NAMED_VALUES[value];
  const fn = value.match(/^rgba?\((.*)\)$/s);
  if (fn) return parseRgbArgs(fn[1]);
  return null;
};

const round = (number) => Number(number.toFixed(6));

export const formatRgba = ([r, g, b, a]) =>
  `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${round(a)})`;

export const toHex = ([r, g, b]) =>
  [r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');

// Spread between the brightest and dimmest channel. Above 40 a colour reads as
// a hue (amber, red, blue) rather than a tinted neutral (#c9c2b2, #3a2020).
export const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
export const isChromatic = (rgba) => chroma(rgba) > 40;

// WCAG relative luminance.
export const luminance = ([r, g, b]) => {
  const linear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

// Lettering this dark is only legible on a bright fill, so wherever it paints
// text it is on-accent lettering, never a page neutral.
export const isDarkLettering = (rgba) => rgba[3] === 1 && luminance(rgba) < 0.05;

// Replace every var(--name[, fallback]) whose name `lookup` knows with its
// value, recursively. Unknown names take their fallback when `fallbacks` is
// set (as the browser would), else stay as written.
export const substituteVars = (text, lookup, { fallbacks = true } = {}, depth = 0) => {
  if (depth > 20) throw new Error(`var() cycle while evaluating ${text}`);
  const parsed = valueParser(text);
  let changed = false;
  parsed.walk((node) => {
    if (node.type !== 'function' || node.value !== 'var') return undefined;
    const name = node.nodes[0]?.value;
    const comma = node.nodes.findIndex((child) => child.type === 'div' && child.value === ',');
    const fallback = comma === -1 ? null : valueParser.stringify(node.nodes.slice(comma + 1));
    const value = lookup(name);
    const replacement = value ?? (fallbacks ? fallback : null);
    if (replacement == null) return false;
    node.type = 'word';
    node.value = substituteVars(replacement.trim(), lookup, { fallbacks }, depth + 1);
    delete node.nodes;
    changed = true;
    return false;
  });
  return changed ? valueParser.stringify(parsed) : text;
};

// + - * / and parentheses over plain numbers; null for anything else.
const evaluateArithmetic = (expression) => {
  const tokens = expression.match(/\d*\.?\d+(?:e[+-]?\d+)?|[-+*/()]|\S/gi) ?? [];
  let at = 0;
  const primary = () => {
    const token = tokens[at++];
    if (token === '(') {
      const value = sum();
      return tokens[at++] === ')' ? value : NaN;
    }
    if (token === '-') return -primary();
    return /^\d*\.?\d+(?:e[+-]?\d+)?$/i.test(token ?? '') ? Number(token) : NaN;
  };
  const product = () => {
    let value = primary();
    while (tokens[at] === '*' || tokens[at] === '/') {
      value = tokens[at++] === '*' ? value * primary() : value / primary();
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (tokens[at] === '+' || tokens[at] === '-') {
      value = tokens[at++] === '+' ? value + product() : value - product();
    }
    return value;
  };
  const result = sum();
  return at === tokens.length && Number.isFinite(result) ? result : null;
};

// Fold calc() whose operands are all numbers into its number.
export const foldCalc = (text) => {
  const parsed = valueParser(text);
  let changed = false;
  parsed.walk((node) => {
    if (node.type !== 'function' || node.value !== 'calc') return;
    const result = evaluateArithmetic(valueParser.stringify(node.nodes));
    if (result === null) return;
    node.type = 'word';
    node.value = String(round(result));
    delete node.nodes;
    changed = true;
  }, true);
  return changed ? valueParser.stringify(parsed) : text;
};

// The colour a token expression paints, e.g.
// `rgb(var(--ct-gold-bg-rgb) / calc(0.2 * var(--ct-k-accent-bg)))` → [232, 163, 61, 0.2].
export const evaluateColor = (text, lookup) => parseColor(foldCalc(substituteVars(text, lookup)));
