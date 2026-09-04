# PROTOTYPE — Defense Sheet controls on the matchup page

Throwaway. Lives on branch `prototype/matchup-toolbar-look`; nothing here
should reach `master`.

**Question:** the controls above the Defense Sheet on `/matchups/:gameId` are
three rows of same-weight segmented chips (stat category · window ·
deviation · defense team). The defense-team toggle is the only control that
changes what the whole page is about, yet it sits last in a row of filters.
Where should the team switch live, and how should the remaining chip rows
read?

Three variants, rendered on the existing matchup route with live data,
switchable from the floating bar at the bottom of the screen (or `←` / `→`).

## Run it

```
npm start
```

then open `http://localhost:5173/matchups/<gameId>?proto=toolbar` while
signed in. For live production data without CORS, run the branch-only
`vite.proto.config.mjs` proxy instead:

```
npx vite --host --config vite.proto.config.mjs
```

## Variants

- `?proto=toolbar&v=A` — **Side tabs.** The team switch becomes two full-width
  tabs at the top of the sidebar, above the injury report and the player
  rail. Each tab reads `MEM defense` with a small mono sub-line
  `vs PHI players`, so the tab explains why the rail lists the players it
  lists. The workspace keeps the stat-category pills, but the window and
  deviation groups get tiny mono eyebrow labels (`WINDOW`, `SHOW`) so they
  read as two named filters rather than one long row of look-alike chips.
- `?proto=toolbar&v=B` — **Header switch.** The `MEM @ PHI` title itself is
  the switch: each tricode is a button, the active one is gold with an
  underline, and the eyebrow reads `Viewing MEM defense · vs PHI players`.
  Nothing team-related remains in the sidebar or toolbar. The toolbar
  collapses to one line: stat-category pills scroll horizontally on the
  left, and window + deviation sit on the right as two compact pill groups
  with their current value bold (`Season | Last 15`, `All | 1σ | 2σ`).
- `?proto=toolbar&v=C` — **Sidebar control panel.** Everything except the
  stat category moves into a bordered `Sheet controls` panel at the top of
  the sidebar: a stacked pair of large team buttons (tricode, then
  `defense sheet` and `vs PHI players` in mono), then labelled rows for
  window and deviation. The workspace loses the chip rows entirely and shows
  stat categories as an underlined tab strip (text tabs with a gold
  underline on the active one, no pill borders) sitting directly on top of
  the Defense Sheet.

## What is real and what is not

Everything is real: live matchup data, the real player rail, the real
Defense Sheet, and every control drives the same state the shipped page
uses. Only the placement and styling of the controls change per variant.

## Removing it

Delete this folder, `vite.proto.config.mjs`, and the blocks marked
`PROTOTYPE (throwaway)` in `src/matchups/MatchupDetailPage.js`.
