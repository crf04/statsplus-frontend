# PROTOTYPE — where Saved Filter Sets live

Throwaway, on branch `prototype/saved-sets-placement`; nothing here reaches `master`.

**Question:** today Saved Filter Sets hide in two toolbar buttons (modal) and a
per-player list squeezed under the season strip. Where should they live?

Open the Log Workspace with `#proto=place&v=O|A|B|C` (hash, never query string);
`[` / `]` or the floating bar switch variants. Dev builds only.

- **O** — today, for comparison.
- **A** — a `Saved ▾` menu in the panel header (this player first, then others),
  the set's name under the header when the applied filters are a saved set, and
  `Save` beside Apply that turns into a name field in place (no modal).
- **B** — `Filters | Saved` tabs at the top of the panel; same footer Save.
- **C** — a rail of saved-set pills above the chart and panel, the current set
  filled gold, `+ Save current` at its start.

Real sets come from the account; when it has fewer than four, sample sets
(marked SAMPLE) pad the list. Save really saves; rename/delete go through the
shipped modal.

Removing it: delete this folder and the blocks marked `PROTOTYPE (throwaway)`
in `GameLogFilter.js`, `filterPanel/FilterPanel.js`, `FilterPanelView.js`,
`FilterPanelContext.js`.
