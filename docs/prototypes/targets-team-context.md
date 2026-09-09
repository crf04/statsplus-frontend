# Targets team-context prototype

Throwaway exploration on branch `prototype/targets-team-context`.
No layout has been selected or promoted to production.

## Authoritative request (unedited)

> Want to add team context on the targets page. Like some version of table or something else that shows the team opponent stats so we can be more informed in creating targets. /prototype this

## Explore

Run `npm run prototype:team-context` with the normal development Firebase and API configuration. The command opens `/targets?variant=A`.

- `A`: a table of the selected opponent’s metrics, league ranks, and league comparisons beside saved targets.
- `B`: saved targets beside a team inspector with bars.
- `C`: the selected opponent’s metrics arranged by league rank.

Use the bottom arrows or keyboard left/right arrows to compare layouts. Select a team and stat category, then use a metric to prefill a Target draft. Prototype saves live only in memory and disappear on reload. Existing saved-target links open the normal detail page.

The page uses authenticated live reads through the existing frontend transport. The ordinary `/targets` route and production rendering do not mount the prototype.

## Data contract

Existing `GET /api/teams` and `GET /api/teams/stats?team=…&category=…` only. No API changes.

Current backend reference: `81cefe05915b9f931eaa26937c7fae560551bc98`, `app/services/team_service.py`. The endpoint projects whole-season publications. Traditional, shot-zone, and shot-type volumes use nominal minutes normalized per 48. Percentages remain percentages. Play-type values compare points per possession to the league mean; assist values are league-relative indices. Rank 1 is the lowest value among the published teams, not a universal judgment of defensive quality. The endpoint exposes no refresh timestamp.

## Review status

The user’s request is the temporary spec. No issue hierarchy or PR was published. The prototype branch is retained for a later layout verdict and implementation reference.

## Verification evidence

Frontend base: `2d0d898c26db4a7c83727c2937d16fc116af3aed`. Worktree: `/Users/chrisfu/.t3/worktrees/statsplus-frontend/proto-team-context`.

- `npm run lint`, `npm run format:check`, `npm run build`: passed.
- `npm run test:ci`: 43 suites, 683 tests passed.
- `npm run test:e2e`: 107 passed; 2 deployment-only smoke checks skipped by the suite.
- Coordination `python3 scripts/check.py`: passed with frontend worktree above and backend reference `81cefe05915b9f931eaa26937c7fae560551bc98`.
- Authenticated local frontend directly proxying the production Railway backend: BOS + Spotup prefill, in-memory save, reload reset, URL parameter preservation, arrow-key switching and select-keyboard handling, all five categories. No API write requests occurred in the prototype journey.
- All three variants captured at 1440×900 and 390×844. No document-level horizontal overflow. A's table scrolls horizontally within its panel.

[Desktop/phone comparison gallery](targets-team-context/index.html). The gallery is a captured view; the actual `/targets?variant=A|B|C` route is interactive. All QA app servers were stopped after capture.

Cross-vendor review resolved the date/units, modal/switcher, mixed-unit bar, and rank-highlight findings. Final review confirmed those corrections. Two residual suggestions were checked: rank 1 deliberately maps to the zero end of the labelled scale and retains its `#1` badge (unknown rank renders no track); the backend's `_place` and `_place_ratio` always publish a rank alongside each available value, and the live payload confirms this. No material finding remains unresolved.
