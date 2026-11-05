# PROTOTYPE — clearer "Add a filter" in the Log Workspace panel

Throwaway, on branch `prototype/add-filter-look`; nothing here reaches `master`.

**Question:** the compact panel shows eight terse tiles (Teammate, Last N,
Since, Home / Away, Opponent, Minutes, Opp. defense, Own stat line) with their
hints hidden, in no order. Founder found it confusing (2026-11-05). How should
the filters be offered?

Open the Log Workspace with `#proto=addfilter&v=O|A|B|C|D` (hash, never query
string); ← / → or the floating bar switch variants. Dev builds only.

- **O** — today.
- **A** — grouped tiles: Games / Opponent / Player headings, self-explaining labels.
- **B** — list: one row per filter with its hint on the right, grouped.
- **C** — questions: "Which games?" etc. with one-tap presets (Last 5/10/20, Home, Away, 30+ min) and "…" chips for the rest.
- **D** — sentence: "Narrow Jalen's games…" followed by phrase pills.

Every button opens today's editor; only the offering changes.

Removing it: delete this folder and the blocks marked `PROTOTYPE (throwaway)`
in `filterPanel/FilterPanelView.js`, `App.js`, `contexts/AuthContext.js`, `vite.config.mjs`.

## Standalone build

`REACT_APP_PROTOTYPE=add-filter` replays `mock/recorded.json` (production
responses captured 2026-10-19, copied from prototype/log-workspace-shrink)
with a fake signed-in user, so the link needs no sign-in.
