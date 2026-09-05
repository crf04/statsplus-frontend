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

## Variants (second round, after Chris's "keep them separate")

The slate page owns *today*: a partial-screen region of the Targets active on
that date with the players who fit. The Targets page owns the *definitions*:
every Target irrespective of game, with notes, edit/delete, and the backtest.

The Targets page is always a grid of cards with the basics (opponent,
Qualifiers, note, today's fit count). The letter changes how a card opens:

- **A — top region / expand in place.** Slate: a bordered region above the
  board, one tile per active Target with compact context and fit chips.
  Targets: the card stretches to a full row and the detail unfolds under it.
- **B — side column / own page.** Slate: board on the left, sticky column on
  the right listing active Targets with a name-and-share line per fit.
  Targets: the card is a link to `/prototype/targets/:id`.
- **C — under games / side drawer.** Slate: each game row that has a Target
  grows a block underneath with a dense fit table. Targets: a drawer slides
  in from the right over the grid.

The detail shows every Qualifier with the opponent's live defense-sheet
context, the fits for the loaded game, and the backtest, plus edit/delete.

Standalone routes: `/prototype/matchups?v=A` and `/prototype/targets?v=A`.
The first round (page-with-live-and-idle) is in git history before this commit.

## What is real and what is not

Real: slate, games, opposing pools, Diet Shares, thin flags, defense-sheet
rank / % vs league / σ in both windows, league-average share prefill.
Not real: Target persistence, the resolve and backtest endpoints, the
specific-opponent Log Workspace link (player-only until frontend#84).
