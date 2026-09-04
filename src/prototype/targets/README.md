# PROTOTYPE — Targets page, Slate panel, and Matchup capture

Throwaway. Lives on branch `prototype/targets-look`; nothing here should reach
`master`. Spec: crf04/statsplus#53. Glossary terms Target and Qualifier are in
the coordination repo's CONTEXT.md; ADR 0001 says a Target stores player
criteria, not a team reading, so the title here is always derived.

**Question:** what should the three Target surfaces look like — the Targets
page, the live-Targets panel on the Slate, and saving a Target from a Defense
Sheet row — and which shape makes multi-Qualifier Targets feel natural?

Three variants, one letter drives all three surfaces. Switch with the floating
bar or `←` / `→`. Targets are in memory (five seeds, reload restores them);
players and defensive context are live matchup data; the backtest is a
synthetic stub and says so.

## Run it

```
npx vite --host --config vite.proto.config.mjs
```

then sign in and open:

- `/prototype/targets?date=2026-04-10&v=A` — the page
- `/matchups?date=2026-04-10&proto=targets&v=A` — the Slate panel
- `/matchups/0022501174?proto=targets&v=A` — capture from a sheet row (NOP @ BOS)

## Variants

- **A — Ledger / strip / inline.** Page reads like the Slate: one block per
  live Target with title, game chip, context under a left rule, a fit table,
  and a backtest disclosure; idle Targets as plain rows below. Slate gets a
  bordered strip above the board. A sheet row expands into the form.
- **B — Board / ribbon / modal.** Page is a two-column workspace like the
  matchup detail: a rail of Targets on the left (live dot, fit count), the
  selected Target on the right with context cards, fit table, and backtest
  always open. Slate gets a sticky ribbon of chips under the header. A sheet
  row opens a modal.
- **C — Game-first / sub-lines / builder.** Page is organised by the day's
  games, Targets as cards under each, fits as chips, backtest in a `details`;
  idle Targets in a collapsed bench. Slate rows grow a sub-line per Target. On
  the matchup, sheet rows *add Qualifiers* to a sticky builder drawer, so a
  multi-slice Target is built by tapping rows and saved once.

## What is real and what is not

Real: slate, games, opposing pools, Diet Shares, thin flags, defense-sheet
rank / % vs league / σ in both windows, league-average share prefill.
Not real: Target persistence, the resolve and backtest endpoints, the
specific-opponent Log Workspace link (player-only until frontend#84).
