# PROTOTYPE — filter panel look (throwaway)

**Question:** what should the Log Workspace filter panel look like? The
current panel hides Self Filters behind a click and reads as a stack of
unrelated controls.

Three variants plus the current panel, on the real `/` route, switched with
the floating bar or `←`/`→`. The variant rides the hash
(`#proto=filters&v=A|B|C|D|E|F|G|H|I|J|Now`) because the query string is the Filter Set.

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

Round 3 (what fills the empty band under a pinned panel):

- **G — D + match strip + saved Filter Sets.** An elastic filler that shows
  as much as fits, in order: "N of M games match", a season timeline strip
  (one cell per game; kept games green/red against the line, dropped games
  dim), then saved Filter Sets cut at whole rows. Saved sets are synthetic.
- **H — E + match strip + next opponent.** Same count and strip, then the
  next opponent's ranks for the metrics the line type leans on, each with a
  one-tap "Teams a–b" defensive rule. The captured season is over, so the
  opponent (@ CHA) is a labelled demo; the ranks are CHA's real ones.

Trap found: `/api/teams/stats` ranks 1 = lowest value (Utah allows the most
points and is rank 30), but `rank_filter[]` ranks 1 = highest. H flips it
(filter rank = 31 − team rank). The G/H filler needs the unfiltered season
request on load, which production currently makes only for Own stats.

Round 4 (G chosen, plus the demo game):

- **I — G + every top-8 / bottom-8 opponent rank.** The next opponent
  (@ CHA, demo) listed across all five team-stat categories (general, play
  type PPP, assists, zones, shot type): 18 of 53 stats sit in the top or
  bottom 8. Each filterable one has a "+" that adds the matching tier as a
  defensive rule (1–8 for "most", 23–30 for "fewest"). Priority when space
  is short: match count, opponent summary line, 3-row strip, opponent rows,
  saved sets. "+ N more" (or the summary) expands the list and the panel
  scrolls.

Caveats: the list reads `/api/teams/stats` ranks (per game, 1 = fewest);
the defensive filter ranks a per-48 Season publication, so a tier can
disagree with the list by a place near the cut. Zone stats and a few
general ones (FG%, OREB, DREB…) have no defensive filter, so no "+".

Correction: Playtypes (and Assists) values from `/api/teams/stats` are the
team's rate over the league average (Misc 1.171 = 17% more points per
possession than average), not raw PPP; the card shows "+17% vs avg". Volume
per play type lives in the separate "Playtype Points" category (per-48).

Round 5 (keep saved sets beside the demo game):

- **J — I, reworked.** "N of M games match" is now the strip's title, and
  the progress bar is gone. Saved Filter Sets are always shown (at least two
  rows plus "+ N more"). Spare height goes to demo-game rows first, then
  saved sets. The "Add a filter" tiles are single-line buttons in three
  columns, to make room. On a phone the filler shows in page flow with fixed
  counts. At 1280 wide the minimum doesn't fit, so the panel scrolls about
  50px.

## Verdict (2026-09-30)

**J wins.** Chris chose J after reviewing A–J ("i like it"), with one last
change: the strip legend reads "over · under · filtered out" without the line
value. What J settles:

- Filter Set shown as a sentence at the top (B), with single-line "+ Add a
  filter" buttons in three columns.
- On desktop the panel takes exactly the chart card's height. Apply is pinned
  to the bottom, and the content scrolls inside the panel if it overflows.
- Under the filters, in priority order: the season strip titled "N of M games
  match" (no progress bar), the next opponent's top/bottom-8 ranks with
  one-tap tier rules, and saved Filter Sets (always at least two rows).
- On a phone the same blocks show in page flow.

Open items for the real build: the next game comes from the game-log
response, not a demo; the opponent list and the defensive filter must share
one rank source (team-stats ranks run 1 = fewest, filters 1 = most); the
strip needs the unfiltered season request on load; 1280-wide screens scroll
about 50px.
