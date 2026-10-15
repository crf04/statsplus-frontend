# PROTOTYPE — Matchup page declutter (throwaway)

Question: on a historical Matchup (CLE @ ORL, 2026-03-11), how much provenance
text can go, and how should each player's line from that game read?

All variants: bigger small type; no "Season defense provenance" line, no
"Completed-season context" line, no rail instruction, no repeated
"No displayed Diet Shares" note; injuries and Last 15 gaps fold into the header.

- `?v=O` current page (baseline)
- `?v=A` stat-grid cards (MIN PTS REB AST 3PM) + status chips in the header
- `?v=B` box-score table (Score column when a market is picked) + "About this data" disclosure
- `?v=C` one stat per player vs his season average + one-sentence header note

Standalone build: `REACT_APP_PROTOTYPE=historical npm run build` serves captured
production payloads from `mock/` with a fake signed-in user.

Game state (switcher dropdown, `?demo=`):

- _(none)_ completed game, real capture
- `upcoming` upcoming twin with SAMPLE lines (`mock/make_upcoming.py`; rerunnable)
- `upcoming-bare` the same twin as today's contract sees it: which books post
  which market, no line numbers. Showing real lines needs a backend contract
  change: the providers parse `line_score` / `stat_value` but the matchup
  response only carries `posted_markets` and `provenance`.

Each variant keeps its rail shape across states: A's grid and B's table hold
the box score after the game and lines before it; C's big number is the result,
the line, or (no line numbers) the Matchup Score.

## Verdict (2026-10-14, provisional)

C, opening on the Points tab rather than All, so the rail's one stat and the
Defense Sheet agree on first paint. Real lines need the backend to add line
numbers to the matchup response.

## Defense Sheet readability (C1–C3)

Same C rail and header, three sheets (`sheets.js`): plain-English slice and
measure names, rank in words (30 = allows the most), one headline % vs league
(σ and per-48 in a tooltip), Save as Target as an icon, leans capped at three.

- `?v=C1` plain rows · `?v=C2` one row per slice, measures side by side · `?v=C3` diverging bars
- `?v=C4` today's card look (rank squares, pill chips) made readable · `?v=C5` C4 with one card per slice
- `?v=C6` C2 without cards: play types points only (possessions dropped); shot types and zones pair attempts with makes, the off-market measure dimmed
- `?v=C7` C6 with number tiles (rank square + %), no category box, players as quiet mono tags
- `?v=C8` refined: softest spots first, aligned measure columns, rank as a marker on a fewest→most track, players as a muted line, save on hover
