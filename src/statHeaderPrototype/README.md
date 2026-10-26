# PROTOTYPE — smaller Log Workspace stat header

Throwaway, on branch `prototype/compact-stat-header`; nothing here reaches `master`.

**Question:** the avatar + 2×4 stat tiles above the Log Workspace take ~260px
of height. What smaller shape should they take?

Open the Log Workspace with `#proto=stats&v=O|A|B|C|D` (hash, never query
string); ← / → or the floating bar switch variants. Dev builds only.

- **O** — today.
- **A** — compact tiles: small avatar, one row of eight small tiles.
- **B** — ribbon: one line of `PTS 6.2 +0.4` stats.
- **C** — box-score line: label / filtered / vs-season rows.
- **D** — lead four (PTS REB AST MIN) + four chips.

Removing it: delete this folder and the blocks marked `PROTOTYPE (throwaway)`
in `PlayerStatsCards.js`, `App.js`, `contexts/AuthContext.js`, `vite.config.mjs`.

## Standalone build

`REACT_APP_PROTOTYPE=stat-header` replays `mock/recorded.json` (production
responses captured 2026-10-19 for the saved-sets prototype) with a fake
signed-in user, so the link needs no sign-in.
