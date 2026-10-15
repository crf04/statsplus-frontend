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

- *(none)* completed game, real capture
- `upcoming` upcoming twin with SAMPLE lines (`mock/make_upcoming.py`; rerunnable)
- `upcoming-bare` the same twin as today's contract sees it: which books post
  which market, no line numbers. Showing real lines needs a backend contract
  change: the providers parse `line_score` / `stat_value` but the matchup
  response only carries `posted_markets` and `provenance`.

Each variant keeps its rail shape across states: A's grid and B's table hold
the box score after the game and lines before it; C's big number is the result,
the line, or (no line numbers) the Matchup Score.
