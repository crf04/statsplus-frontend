# Colour in CourtAI

Every colour in `src/` comes from a `--ct-*` token in `src/theme.css`. `npm run lint` fails on a
raw hex, `rgb()`, `hsl()` or named colour anywhere else, unless
[`color-allowlist.json`](color-allowlist.json) gives a reason.

Pick the token by what the colour does:

| You are painting                                   | Use                                                         |
| -------------------------------------------------- | ----------------------------------------------------------- |
| amber, green or red text, icons, borders, outlines | `--ct-gold` (`-hover`, `-press`), `--ct-hit`, `--ct-miss`   |
| a solid amber, green or red surface (button, chip) | `--ct-gold-fill` (`-hover`, `-press`), `--ct-hit-fill`, ... |
| lettering on that surface                          | `--ct-on-gold`                                              |
| a translucent tint behind content                  | `--ct-<family>-bg-<alpha>`, e.g. `--ct-gold-bg-20`          |
| a translucent bar, swatch or ramp end (alpha ≥ .5) | `--ct-<family>-fill-<alpha>`, e.g. `--ct-hit-fill-78`       |
| a translucent line or text on top, or a ring       | `--ct-<family>-fg-<alpha>`, e.g. `--ct-overlay-fg-10`       |
| a drop shadow / a modal backdrop                   | `--ct-shadow-<alpha>` / `--ct-scrim-<alpha>`                |

Light mode scales a tint's alpha up and a wash's down, so a translucent bar would turn opaque and
merge with its neighbours. Accent paint at alpha 0.5 and above is therefore a data mark: the
`fill` steps keep their alpha in every theme (`MARK_ALPHA` in `roles.mjs`). A ring is a
`box-shadow` with no blur and paints like a line; with blur it is a shadow or a glow. `--ct-line`
paints a background only on a hairline box (1px wide or tall, or a 1px grid gap); any other
surface takes `--ct-overlay-bg-<alpha>`.

Families are `overlay` (white on dark), `gold`, `hit`, `miss`, `slate`, the Connect
`series-kept`, `series-lead`, `series-dropped` and `series-pink`, `ink`, `surface` and `text`.
Only `gold`, `hit` and `miss` have `fill` steps. A component that picks its colour per class holds
a channel in a custom property (`--oc: var(--ct-gold-fg-rgb)`); its alpha must carry the side's
multiplier, `rgb(var(--oc) / calc(0.9 * var(--ct-k-accent-fg)))`, and the lint follows the
property to the value the reading rule sets, else one set on an ancestor or the root, else one set
in the same stylesheet. A JS name whose family is chosen at runtime, `` `--ct-${family}-bg-rgb` ``,
is held to the accent families' multipliers and roles. The alpha is a percentage with `p` for a decimal point (`1p5` is 0.015) or `x<hex>` for an
8-digit hex alpha. The step does not need to exist yet: write the name, run
`node scripts/theme/tokenize.mjs --write`, and it is defined. `--ct-x-<hex>` tokens keep a legacy
shade exact; the lint stops their count from growing.

In JS, DOM styles take `var(--ct-*)` strings. Canvas (Chart.js) cannot read CSS variables, so it
takes concrete colours from `useThemeColors` in `src/theme/useThemeColors.js`, requested as
`[role, '--ct-token']` pairs (`over: ['fill', '--ct-hit-fill-78']`) so the lint checks each token
against the role it plays.

## Tools

- `tokenize.mjs` moves literals onto tokens by role and keeps the generated block at the end of
  `src/theme.css` in step with what `src/` references. A second `--write` changes nothing.
- `check-colors.mjs` is the lint. `npm run lint` also runs `tokenize.mjs --check`, so a literal
  the codemod would move, or a stale generated block, fails CI.
- `verify-dark.mjs --base <ref>` compares every rewritten declaration with the base revision, tokens
  replaced by their dark values and component custom properties by the value each rule gives them,
  and exits 1 on any difference or any declaration that moved earlier in the cascade. A component
  custom property whose setters change has every consumer re-checked, and one that moved, gained
  a setter or was removed while still read fails.
