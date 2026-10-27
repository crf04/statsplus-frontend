# PROTOTYPE — smaller, simpler Log Workspace chart card

Throwaway, on branch `prototype/log-workspace-shrink`; nothing here reaches `master`.

**Question:** the chart card (Player / Line Type / Line Value boxes, RAW ·
PER-36 · HIT RATE cards, "Player: X" chip, bar chart) is ~750px tall. How
small and plain can it get?

Open the Log Workspace with `#proto=shrink&v=O|A|B|C` (hash, never query
string); ← / → or the floating bar switch variants. Dev builds only.

- **O** — today.
- **A** — compact: small labelled controls, one strip of three tiles, 260px chart, M/D dates.
- **B** — sentence: "Player PTS over 21.5", hit rate as the headline, 220px chart.
- **C** — chart-first: one pill toolbar, one line of numbers, 200px chart, month ticks only, no y axis.

A–C drop the "Player: X" chip (the Player box already says it) and keep other filter chips.
C hides the Posted Lines picker; the captured data has none, so no variant shows it.

Removing it: delete this folder and the blocks marked `PROTOTYPE (throwaway)`
in `ChartComponent.js`, `GameLogFilter.js`, `App.js`, `contexts/AuthContext.js`, `vite.config.mjs`.

## Standalone build

`REACT_APP_PROTOTYPE=log-shrink` replays `mock/recorded.json` (production
responses captured 2026-10-19, via the stat-header prototype) with a fake
signed-in user, so the link needs no sign-in.
