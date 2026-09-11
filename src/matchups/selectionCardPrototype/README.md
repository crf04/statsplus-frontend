# PROTOTYPE — selection card without the Archetype sample

## Verdict (2026-09-11)

**E wins.** Chris picked A's split first ("I like A"), asked for the card to
look more aesthetic, then chose E over D. Decisions folded into the shipped
card:

- Archetype sample removed, with its hindsight note.
- Score Matrix left, Games vs this opponent right, in two inset panels; stacks
  on phones.
- Matrix cells carry a heat wash scaled to the score (green up, red down),
  dashes faded; Blend column set off with a rule; rows clickable.
- Opponent log leads with the average as a large gold number, then one row
  per game; minutes muted, stat bold, delta coloured by sign.
- Header: name in the display face, one line naming the game (completed:
  matchup and date; upcoming: matchup, tip time, and the books posting
  markets), a round × to close.
- The strip under the name is the stat selector; the chip row is gone.
  Completed game: MIN plus the box score per category. Upcoming game: MIN as
  the last-10 average with its sparkline, then the books posting each market.
  The MIN tile is inert.
- Categories in box-score order everywhere: PTS REB AST 3PM STL BLK TOV FGA
  FG2A FG3A PR PA RA PRA STKS. The page's market tabs use the same order.
- Explainer sentence moves to small print at the foot of the card.
- Matrix columns pinned: Shot types, Shot zones, Play types, Assist locations,
  Traditional, Blend.

Deployed no-login at statsplus-targets-proto.vercel.app (`?demo=pregame` for
the upcoming-game twin).

Throwaway. Lives on branch `prototype/selection-card-layout`; nothing here
should reach `master`.

**Question:** with the Archetype sample removed, how should the Score Matrix
and "Games vs this opponent" share the selection card so it takes less
vertical space? Chris's opening idea: put the opponent log beside the matrix.

Three variants, rendered in place of the shipped card on the existing
`/matchups/:gameId` route, switchable from the floating bar (or `←` / `→`).

## Run it

```
npm start
```

then open `http://localhost:5173/matchups/<gameId>?player=<id>&proto=card` while
signed in. For live production data use the statsplus-live-shots skill.

- `v=A` — **Matrix beside the opponent log.** The ask. Matrix on the left at
  intrinsic width, opponent log on the right. Stacks on phones.
- `v=B` — **Active stat strip, matrix folded.** Only the chip-selected stat's
  scores show, as a strip of source/value pairs with Blend highlighted. The
  opponent log sits under it. The full matrix is behind a "All N categories"
  disclosure.
- `v=D` — **A, ledger.** Same split as A. Signed ink in the matrix (green up,
  red down, dashes faded), rows clickable, Blend column set off. The log leads
  with the average as a large number, then one row per game. Box-score strip
  under the name replaces the focal sentence; explainer moves to small print.
- `v=E` — **A, panels.** D's chrome, but the matrix and the log sit in two
  inset panels, and matrix cells carry a heat wash scaled to the score
  instead of coloured ink.
- `v=C` — **Opponent log as one line.** Matrix unchanged. The opponent log
  collapses to a single line under the chips: average for the active stat,
  minutes, and one pill per game.

## What is real and what is not

Everything is live: the real card header, chips, matrix and h2h payload.
Only the body layout is swapped per variant. The Archetype sample and its
hindsight note are dropped in all three.

## Removing it

Delete this folder and the blocks marked `PROTOTYPE (throwaway)` in
`src/matchups/MatchupDetailPage.js`.
