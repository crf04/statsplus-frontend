# PROTOTYPE — the Targets page, reimagined

Throwaway. Never merge this directory into master; it lives on the branch
`prototype/targets-page-look` as the primary source for whichever look wins.

## Verdict (Chris, 2026-09-06)

- **List page: G "Sheet".** Two read-only criteria cards per row, "+ New Target"
  top right (the composer is the Lab), game-today chip and "Edit →" in each
  card's corner, "Playing tonight" fits as pills, then the Backtest as a
  games-count strip and a margin-graded grid. No game logs on the list.
- **Edit screen: J "Workbench".** Criteria card left with Save/Revert in its
  footer, "← All Targets" and Delete on one top row, summary and graded grid
  under the card, date-ordered game logs on the right.
- **Qualifier drawing: slider (`q=2`)** on a league-scaled track with the
  league tick. **Conditions** (defender minutes incl. sat-out games; date
  window) drawn as the same rows, all added through one "+ and".
- **Stats:** picker over box score, per-36 and efficiency groups; the choice
  sticks to the Target. Summary says games, not players.
- **Lab:** live on change, no button; Save explicit for the Target.

Not shipped from here. What the backend needs before folding in: Conditions on
the Target and in the backtest/preview reads; the backtest carrying the box
line and minutes (or the derived columns); a diet-baseline read for league
averages; stat preferences on the Target record.

**Question:** what should `/targets` look like now that Targets resolve
against a day and open into their own page? The shipped page is a form on top
of a card grid: the composer takes the first screen, the collection is below
the fold, and every card says the same thing in the offseason.

**Plan:** three variants on the existing `/targets` route, switched by
`?proto=targets&v=A|B|C`. `date=YYYY-MM-DD` is passed through to the resolve
read so the page can be judged on a day the opponents actually played
(`2026-04-10` has MIA, NOP @ BOS on the slate). The floating bar at the bottom
steps variants and sets the date; `←`/`→` also step.

| Key | Name   | Structure                                                                                                                                                                                                                                                                                                         |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Ledger | One row per Target in a dense ledger; a row opens in place to show the day's readings and fits; the composer is the empty row at the foot.                                                                                                                                                                        |
| B   | Desk   | A rail of Targets on the left, one Target read in full on the right; "New" swaps the pane for the composer.                                                                                                                                                                                                       |
| D   | Record | History-first ledger: hit rate, mean margin and a strip of every game per Target; a row opens into the leaderboard of who cashed.                                                                                                                                                                                 |
| E   | Season | History-first timeline: one axis Oct → now, a lane per Target, every game a tick; receipts feed under it; small composer at the foot.                                                                                                                                                                             |
| F   | Report | History-first reports: a written verdict, a margin strip chart per stat column, the top five players; sentence composer.                                                                                                                                                                                          |
| G   | Sheet  | Round 3. The page is the criteria: one read-only section per Target with its Backtest beneath (graded grid + date-ordered games); a Draft Target section at the top is the Lab, re-reading as it is composed. Saved criteria are not editable here and show no game logs; those are on the Target's page (Chris). |
| H   | Bench  | Round 3. A rail of criteria; the chosen one on the bench as a fixed sentence with its Backtest beneath; New puts a live sentence on the bench, which is the Lab.                                                                                                                                                  |
| C   | Board  | Today's live Targets as scoreboard tiles, idle ones as a quiet list; the composer is a sentence you fill in, which is also the derived title.                                                                                                                                                                     |

Second round (Chris, 2026-09-06): "less about the upcoming game, more about
history; the upcoming stuff is on the matchups page" → D, E, F, built on the
backtest read (`/<id>/backtest`, one per Target, up front).

Third round (Chris, 2026-09-06): "the Lab should be integrated; the page should be
the criteria; keep the date-ordered backtest; grade the hit-rate grid so more
green is beat by more" → G, H. Rebased on master with the shipped Lab (#97).
The deployed standalone build answers an edited draft with one captured
preview (`mock/preview-sample.json`) and says so; only a signed-in build
re-reads the season.

Fourth round (Chris, 2026-09-06): "prototype the edit screen" → I, J, K on the
real `/targets/:id` route, keyed by `dv` (`?proto=targets&dv=I`). Editing lives
here and nowhere else; the criteria are always live, the Lab reads beneath.

| Key | Name      | Structure                                                                                                                                                                                                              |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I   | Worksheet | One column: criteria (form controls), actions, then the Lab in full — summary, graded grid, every game newest first.                                                                                                   |
| J   | Workbench | Two columns: the criteria (form controls), actions, summary and grid pinned on the left; the games as a long list on the right. **Verdict (Chris, 2026-09-06): this layout, with I's criteria; now the default `dv`.** |
| K   | Players   | Criteria on top; evidence grouped by player, ranked by margin, each with a graded strip; a row opens into its games.                                                                                                   |

The stat choice sticks to the Target (Chris, 2026-09-06: "I want it to stick"):
`statPrefs.js` keeps shown columns and the graded column per Target id in
localStorage, read by the list card and the edit screen alike. Shipped: two
fields on the Target record, saved on change.

Stats picker (Chris, 2026-09-06: "select the stats that show up like PTS, PR,
FGA"): the summary strip's `stats ▾` toggles any of 21 box-score stats as
columns; the grid grades by whichever column is pressed. The backend only
sends the proxy columns, so `mock/box-<id>.json` holds every Backtest player's
2025-26 regular-season box score vs the opponent plus season averages over all
their games, captured from the production database. A signed-in build without
that capture can only offer the proxies; shipping this means the backtest
response carrying the box score.

Conditions (Chris, 2026-09-06): "players with high rim rate against MIN when
Gobert doesn't play" → a defender-minutes Condition (games he sat out count as
0 min) and a date window, on the criteria card; they filter the Backtest's
games on the client. Every team's per-game minutes are in `mock/rosters.json`
(captured from the production database). Shipping this means the backtest and
preview reads taking Conditions as input and the Target storing them.

Qualifier drawings `q=1|2|3` (track, slider, line). **Verdict (Chris, 2026-09-06): 2, the slider; now the default.**

League-average hint beside every threshold (Chris, 2026-09-06): `lg 28%`, press
to use it. Table in `mock/league-averages.json`, lifted from a Matchup payload;
shipping it means a read of the diet baselines.

Reads are real (`/api/user/targets`, `/resolve`, `/<id>/backtest`, `/preview`). Saving is a stub: a Target
composed here is kept in memory for the session, marked _unsaved_, and never
sent to the backend.

Start: `npm start` in this worktree, then open
`http://localhost:5173/targets?proto=targets&v=A&date=2026-04-10`.
