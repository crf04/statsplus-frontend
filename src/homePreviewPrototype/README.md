# PROTOTYPE: home-page feature previews (throwaway)

**Question:** should the home page (`/`, the Query Prompt) preview Matchups
and Targets, and in what shape?

Variants on the real home, switched by `#proto=home&v=Z2|Z|Y|O|W|X|T|U|V|R|S|N|O|P|Q|M|K|L|I|J|H|F|G|E|A|B|C|D|Now` (hash,
not query: on `/` the query string is the Filter Set) or ←/→:

- **Z2** questions as one row of chips; Tonight (Best, Toughest) | Your Targets (one-line rows) below
- **Z** Y with three columns: Try a question | Tonight (Best, Toughest) | Your Targets
- **Y** O with "Ask the box score" and a shorter tagline ("Name a player, add what matters, get the logs.") each on one line
- **W** split: `/` is the Tonight home (T layout) with a search door; `/search` is the current Query Prompt + Log Workspace; nav Home | Search
- **X** the same split with the V layout
- **T** Matchups/Targets first: "Tonight" headline, compact search, games grid (3 biggest PTS effects + Targets-firing badge), Targets column
- **U** court hero rewritten ("Find the edge") with Best | Toughest flanking, Targets row, search + path at the bottom
- **V** "Tonight" headline, compact search, two equal doors: Matchups | Targets
- **R** saved Filter Sets left | hero | Tonight right; path + Targets below
- **S** page-length left sidebar (saved Filter Sets + Targets); hero, path, Best | Toughest in the main column
- **N** tabs under the search: Tonight | Try a question
- **O** two columns: questions (stacked rows) | tonight (best, toughest, Targets)
- **P** a one-line Tonight band above the hero, ladder below
- **Q** ladder as a one-line path under the search; Best | Targets | Toughest at the bottom
- **M** hero alone; ladder with "Every filter we understand" in its header; matchups + Targets at the bottom
- **K** I, calmer: slim matchups (one reason each), one-line Targets, compact ladder
- **L** K without Targets
- **I** best matchup left, toughest right, headline centred; two Targets in a centred row below (fits show their PTS matchup)
- **J** mirrored sides: matchup card + one Target per side
- **H** E + spotlight + answer ladder
- **F** E + spotlight: the slate's best and toughest PTS matchup, with the two play types behind each
- **G** E + answer ladder: each ladder step shows its real result (PTS, games, per-game bars)
- **E** C without Targets: ticker with the 3 biggest PTS effects per game
- **A** Targets sidebar (two firing Targets) + slate strip under the search
- **B** "Tonight" board under the search: full scoreboard + two Targets
- **C** Scoreboard ticker above the hero + Target pills under the search
- **D** Game of the night: a mini Matchup with the Targets firing in it
- **Now** the current home

Data: captured production payloads (2026-10-14) for the 2026-04-10 slate:
`slate.json`, `resolve.json` (the owner's resolved Targets) and `edges.json`,
a digest of the fifteen Matchups (season Matchup Score for PTS/REB/AST/3PM).
A real build needs a slate-wide edges read; today it would take 15 Matchup
calls.

Run: `npm start` then `/#proto=home&v=A`. Standalone (no sign-in):
`REACT_APP_PROTOTYPE=home npm run build`.

`hooks.json`: the spotlight picks (non-thin, 12+ PPG) from the fifteen Matchups,
and the three ladder queries' game logs, run through the NL endpoint.
