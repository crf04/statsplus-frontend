# PROTOTYPE — home ticker with every stat (throwaway)

Question: the home ticker shows only each game's three biggest PTS Matchup
effects. What should it look like listing every stat, ~5 rows per game?

- A: stat switch in the label column, top 5 for the picked stat (all 19 markets).
- B: top 5 effects across PTS/REB/AST/3PM/STL/BLK, each tagged with its stat.
- C: one row per stat (PTS REB AST 3PM PRA), the biggest mover for each.

Dev: `npm start`, open `/#proto=ticker&v=A`. Public build:
`REACT_APP_PROTOTYPE=ticker` (captured data, no sign-in).
Data: `python3 derive.py <live-shots --record file> allStats.json`.
