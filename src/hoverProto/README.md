# PROTOTYPE — Game Logs bar hover card

Throwaway, on branch `prototype/hover-card`; nothing here reaches `master`.

**Question:** what should hovering a bar on the Log Workspace chart tell you?
Today it shows date, OPP, opponent rank, MIN and the stat (plus FGA/3PA on PTS).
Every variant reads only the game-log row the chart already has: per-game
closing lines (`closing_lines`), shooting splits, USG%, tracking chances,
`opponent_ranks`, and the filtered averages. No new requests.

State rides the URL hash: `#proto=hover&v=O|A|B|C|D|E|F|G`. A bare `/` opens E.

- **O** — today.
- **A** — the same canvas tooltip, sectioned: result vs the chart's line, the
  closing line it beat or missed, the opponent's rank, then the stat's drivers
  with his average beside each.
- **B** — an HTML mini card: big result coloured over/under, close/line pills,
  a 1–30 rank meter, a 3-column driver grid with ▲▼ vs his average.
- **C** — this game beside his average, row by row (stat, drivers, closing
  line), naming the biggest swing.
- **D** — no floating tooltip: hovering or tapping a bar picks it, a strip under
  the chart shows the full box line, lines and rank, with ‹ › to step games.

**Round 1 verdict (2026-11-13):** D. A/B/C stay in the code but left the switcher.
Teammates OUT was asked for and parked: the backend knows absences (`_absence_split`)
and injury reasons, but `game_logs` rows do not carry them.

**Round 2** — takes on D, all picked by hover/tap with ‹ › to step:

- **E** — two rows: result + over/under pills for close and line + rank meter;
  then drivers with ▲▼ vs his average, the rest of the box line quieter.
- **F** — one compact bar *above* the chart, so a phone sees it while tapping.
- **G** — scoreboard: closing line and opponent up top, then one column per stat
  with this game big, his average and the gap under it.

Drivers per stat live in `gameFacts.js` (`DRIVERS`).

## Standalone build

`REACT_APP_PROTOTYPE=hover` replays `mock/recorded.json` (production responses
captured 2026-11-11 with `live-shots --record`, `/api/user/*` dropped) with a
fake signed-in user. Screenshots: `node src/hoverProto/shots.mjs <base-url> <out-dir>`.

Removing it: delete this folder and the blocks marked `PROTOTYPE` in
`ChartComponent.js`, `App.js`, `contexts/AuthContext.js`, `vite.config.mjs`.
