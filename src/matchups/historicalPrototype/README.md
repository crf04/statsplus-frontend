# PROTOTYPE — historical Matchup declutter (throwaway)

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
