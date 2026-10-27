// Palette B "Chalk": the colour mapping of the light-mode prototype the
// founder chose (branch prototype/light-mode, b6e6dcd,
// src/lightModePrototype/recolor.js `mapParsed`, variant B of mode.js). Only
// the pure mapping is ported; it seeds the light value of each legacy shade.
// Neutrals follow the palette's lightness curve through its anchors, amber,
// green and red darken to read on white, translucent white becomes
// translucent ink.

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const rgbToLab = ([r, g, b]) => {
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const labToRgbRaw = ([L, A, B]) => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(toGamma);
};

// Pull chroma in until the colour fits sRGB.
const labToRgb = ([L, A, B]) => {
  for (let k = 1; k > 0; k -= 0.05) {
    const rgb = labToRgbRaw([L, A * k, B * k]);
    if (rgb.every((v) => v >= -0.001 && v <= 1.001))
      return rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  }
  return labToRgbRaw([L, 0, 0]).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export const CHALK = {
  neutrals: [
    ['#000000', '#eceef0'],
    ['#0d0b07', '#f3f4f6'],
    ['#16130d', '#ffffff'],
    ['#1e1a12', '#f7f8fa'],
    ['#241f15', '#eef0f3'],
    ['#3a3428', '#d5d9df'],
    ['#9b937f', '#5f6670'],
    ['#c9c2b2', '#3b414a'],
    ['#efe9dc', '#15181d'],
    ['#ffffff', '#0b0d10'],
  ],
  accentText: '#9a5b06',
  accentFill: '#e8a33d',
  hit: '#1f7a4c',
  miss: '#b4373a',
};

const NEUTRAL_CHROMA = 0.045;
const LINE_BOOST = 1.35;
const chroma = ([, a, b]) => Math.hypot(a, b);

const anchors = CHALK.neutrals
  .map(([dark, light]) => [rgbToLab(hexToRgb(dark)), rgbToLab(hexToRgb(light))])
  .sort((x, y) => x[0][0] - y[0][0]);

const curve = (L) => {
  if (L <= anchors[0][0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i += 1) {
    const [d0, l0] = anchors[i - 1];
    const [d1, l1] = anchors[i];
    if (L <= d1[0]) {
      const t = (L - d0[0]) / (d1[0] - d0[0] || 1);
      return l0.map((v, j) => v + (l1[j] - v) * t);
    }
  }
  return anchors[anchors.length - 1][1];
};

const targets = {
  ink: rgbToLab(hexToRgb(CHALK.neutrals.find(([dark]) => dark === '#efe9dc')[1])),
  accent: rgbToLab(hexToRgb(CHALK.accentText)),
  accentFill: rgbToLab(hexToRgb(CHALK.accentFill)),
  hit: rgbToLab(hexToRgb(CHALK.hit)),
  miss: rgbToLab(hexToRgb(CHALK.miss)),
};

const hueFamily = ([, a, b]) => {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h > 110 && h < 200) return 'hit';
  if (h > -40 && h < 40) return 'miss';
  return 'accent';
};

const rounded = (alpha) => Math.round(alpha * 1000) / 1000;

// [r, g, b, a] in dark → [r, g, b, a] in Chalk. `role` is 'text' (glyphs,
// lines), 'fill' or 'shadow', as the prototype's.
export const chalk = ([r, g, b, alpha], role) => {
  const lab = rgbToLab([r, g, b]);
  if (chroma(lab) < NEUTRAL_CHROMA) {
    if (alpha < 1) {
      // Translucent white is a line or a wash: lines get stronger on light,
      // washes weaker.
      if (lab[0] > 0.5) {
        return [
          ...labToRgb(targets.ink),
          rounded(Math.min(1, alpha * (role === 'fill' ? 0.55 : LINE_BOOST))),
        ];
      }
      if (role === 'shadow') return [r, g, b, rounded(alpha * 0.35)];
      // A nearly opaque dark ground (a sticky header over content) turns light.
      if (alpha >= 0.6) return [...labToRgb(curve(lab[0])), alpha];
      // Dark washes and scrims stay dark.
      return [r, g, b, alpha];
    }
    return [...labToRgb(curve(lab[0])), 1];
  }
  // A dark tinted ground: neutral, with a hint of its hue.
  if (lab[0] < 0.42) {
    const mapped = curve(lab[0]);
    return [...labToRgb([mapped[0], lab[1] * 0.35, lab[2] * 0.35]), alpha];
  }
  const family = hueFamily(lab);
  if (alpha < 1) return [r, g, b, rounded(Math.min(1, alpha * 1.35))];
  if (role === 'fill' && family === 'accent') {
    const t = targets.accentFill;
    return [...labToRgb([t[0] * (lab[0] / 0.775), lab[1], lab[2]]), 1];
  }
  const target = targets[family];
  // Keep relative steps (hover is lighter) around the family's target.
  const ref = family === 'accent' ? 0.775 : family === 'hit' ? 0.67 : 0.56;
  const L = target[0] + (lab[0] - ref) * 0.6;
  const scale = chroma(target) / (chroma(lab) || 1);
  return [...labToRgb([L, lab[1] * Math.min(scale, 1.2), lab[2] * Math.min(scale, 1.2)]), 1];
};
