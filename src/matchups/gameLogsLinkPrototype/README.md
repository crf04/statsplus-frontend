# PROTOTYPE — game logs link on the matchup player card

Throwaway. Lives on branch `prototype/game-logs-link-look`; nothing here
should reach `master`.

**Question:** how should a player card on `/matchups/:gameId` hand you off to
that player's game logs? The shipped card (commit `ebb8192`) puts a small gold
"Game logs" text link under the season scoring line, and it reads as clutter.

Four variants, rendered on the existing matchup route in place of the shipped
link, switchable from the floating bar at the bottom of the screen (or `←` /
`→`).

## Run it

```
npm start
```

then open `http://localhost:5173/matchups/<gameId>?proto=logs` while signed
in. For live production data without CORS, run the branch-only
`vite.proto.config.mjs` proxy instead:

```
npx vite --host --config vite.proto.config.mjs
```

- `?proto=logs&v=A` — **Name is the link.** The player name itself links to
  the logs, with a small ↗ after it. No extra line. Hover turns it gold.
- `?proto=logs&v=B` — **Arrow on the name row.** Name stays plain; a round
  chevron sits at the right edge of the name row. Icon-only, `title` and
  `aria-label` say "game logs".
- `?proto=logs&v=C` — **Footer action pair.** Nothing changes up top; a
  "Game logs →" sits beside "Open selection card" in the card footer as a
  second action.
- `?proto=logs&v=D` — **Logs tag by the score.** A mono `LOGS ↗` pill inline
  after the PPG line, in the same family as the market chips.

The variant rides the query string because this route only reads `player`
from it and copies everything else through when the selection changes.

## What is real and what is not

Everything is real: live matchup data, the real card, and the link really
navigates to `/?player_name=…`. Only the header and footer of the card are
swapped per variant.

## Removing it

Delete this folder, `vite.proto.config.mjs`, and the blocks marked
`PROTOTYPE (throwaway)` in `src/matchups/MatchupDetailPage.js`.
