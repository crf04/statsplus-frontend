# Colour in CourtAI

Every colour in `src/` comes from a `--ct-*` token in `src/theme.css`. `npm run lint` fails on a
raw hex, `rgb()`, `hsl()` or named colour anywhere else, unless
[`color-allowlist.json`](color-allowlist.json) gives a reason.

Pick the token by what the colour does:

| You are painting                                    | Use                                                         |
| --------------------------------------------------- | ----------------------------------------------------------- |
| amber, green or red text, icons, borders, outlines  | `--ct-gold` (`-hover`, `-press`), `--ct-hit`, `--ct-miss`   |
| a solid amber, green or red surface (button, chip)  | `--ct-gold-fill` (`-hover`, `-press`), `--ct-hit-fill`, ... |
| lettering on that surface                           | `--ct-on-gold`                                              |
| a translucent tint behind content                   | `--ct-<family>-bg-<alpha>`, e.g. `--ct-gold-bg-20`          |
| a translucent line or text on top                   | `--ct-<family>-fg-<alpha>`, e.g. `--ct-overlay-fg-10`       |
| a drop shadow / a modal backdrop                    | `--ct-shadow-<alpha>` / `--ct-scrim-<alpha>`                |

Families are `overlay` (white on dark), `gold`, `hit`, `miss`, `slate`, `ink`, `surface` and
`text`. The alpha is a percentage with `p` for a decimal point (`1p5` is 0.015) or `x<hex>` for an
8-digit hex alpha. The step does not need to exist yet: write the name, run
`node scripts/theme/tokenize.mjs --write`, and it is defined. `--ct-x-<hex>` tokens keep a legacy
shade exact; the lint stops their count from growing.

In JS, DOM styles take `var(--ct-*)` strings. Canvas (Chart.js) cannot read CSS variables, so it
takes concrete colours from `useThemeColors` in `src/theme/useThemeColors.js`.

## Tools

- `tokenize.mjs` moves literals onto tokens by role and keeps the generated block at the end of
  `src/theme.css` in step with what `src/` references. A second `--write` changes nothing.
- `check-colors.mjs` is the lint.
- `verify-dark.mjs --base <ref>` compares every rewritten declaration with the base revision, tokens
  replaced by their dark values, and exits 1 on any difference.
