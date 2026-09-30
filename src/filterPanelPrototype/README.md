# PROTOTYPE — filter panel look (throwaway)

**Question:** what should the Log Workspace filter panel look like? The
current panel hides Self Filters behind a click and reads as a stack of
unrelated controls.

Three variants plus the current panel, on the real `/` route, switched with
the floating bar or `←`/`→`. The variant rides the hash
(`#proto=filters&v=A|B|C|D|E|F|Now`) because the query string is the Filter Set.

- **A — Grouped sheet.** Everything visible in four groups (Lineup, Games,
  Matchup, Own stats); values read beside labels; sticky Apply bar.
- **B — Sentence + add menu.** Active filters read as a list at the top;
  every other filter is a tile that opens one editor at a time.
- **C — Summary rows.** Settings-style list, label left and value right;
  rows open in place.

Round 2 (B and C read cleaner, but their height does not match the chart
card beside them; the row takes the taller column's height):

- **D — B, filling the chart card's height.** From 768px up, the chart card
  sets the row height; the panel fills it exactly, Apply pinned at the
  bottom, content scrolling inside if an editor overflows.
- **E — C, filling the chart card's height.** Same treatment for C.
- **F — Filter bar.** No sidebar: C's rows become buttons in a bar above a
  full-width chart (fixed 380px tall), each opening a popover editor.

All variants share `useFilterPanel.js`, a copy of FilterOptions' state and
apply logic, so every control really applies. One behaviour change under
test: the Own stats list is static (the game-log row shape), so it renders
without a click; only slider bounds wait for the season request, which
fires when the stat control is first touched.

Run locally: `npm start`, open `/?player_name=...#proto=filters&v=A`.
Standalone (captured Jalen Johnson payloads, no sign-in):
`REACT_APP_PROTOTYPE=filters npm run build`.
