# PROTOTYPE: home-page feature previews (throwaway)

**Question:** should the home page (`/`, the Query Prompt) preview Matchups
and Targets, and in what shape?

Variants on the real home, switched by `#proto=home&v=A|B|C|D|Now` (hash,
not query: on `/` the query string is the Filter Set) or ←/→:

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
