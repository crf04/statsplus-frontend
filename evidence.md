# Slate today/game-day neighbours + Search season select: QA and production evidence

Contract: statsplus docs/contracts/slate-game-days-and-seasons.md (coordination e3a32a60f21d).
Run 2026-10-14 22:00-22:30 EDT (2026-10-15 02:xx UTC: the UTC date was already Oct 15, so a UTC-dated "today" would have been caught).

## Revisions
- Frontend claude/slate-today-season-selector @ b8e96f953850d5e360b4799f8c490ae6166daf2f (PR crf04/statsplus-frontend#188), tree clean
- Backend claude/slate-neighbors-seasons @ 1f46d9a00dd4df7f33a1d553a1e8e0c2fd5f67f9 (PR crf04/statsplus-backend#370), tree clean
- QA snapshot SHA-256 3fe69266e135d9ed9e6f671d01e7034c7d529a6ee3a9fa6395851b003ee222f5

## QA (isolated local backend + disposable Postgres clone, real Firebase auth)
Session A (frozen seed, single season): Result passed, 57 steps, journey SHA-256 0ce239018740d38fa57e2394588848716c342d049042ed3494e044ab4e5f362c, cleanup: owned runtime removed.
Session B (second season seeded in the disposable clone): Result passed, 40 steps, journey SHA-256 8d9834f3afe529b684e735211bdb53a3a06dde1b68dc7a5881b156175a23feba, cleanup: owned runtime removed.
(Hash covers browser commands only; `_hook` steps for API capture/seeding are in journeys/*-source-with-hooks.jsonl and drive.py.)

| Journey | Verdict | Evidence |
| --- | --- | --- |
| a. /matchups no date requests today US Eastern (2026-10-14; request GET /api/games/slate?date=2026-10-14 200; date input 2026-10-14) | passed | qa-a-slate-no-date-today-empty-{desktop,phone} |
| b. empty Slate shows Previous/Next game day buttons with dates; clicking lands on a date with games (today -> Prev "Sunday, April 12, 2026" -> 15 games; 2026-02-17 -> Prev 02-12 (3 games), Next 02-19 (10 games)); Next hidden when next_game_date null | passed | qa-b-* desktop and phone |
| c1. single season: Season select absent (seasons=["2025-26"]) | passed | qa-c-search-single-season-no-select-{desktop,phone} |
| c2. two seasons: select shown (default 2026-27); choosing 2025-26 updates URL (season_filter=2025-26) and results (5 of 5 -> 5 of 60 games), reload keeps it, switching back works; desktop and phone | passed (synthetic 2026-27 data, see limits) | qa-c-two-seasons-* |
| d. API JSON | captured | api/*.json |

Assertions are asserted displayed effect (URL, select value, sample-size text, response window), not only selected state.

## Production read-only compatibility (local frontend branch -> production Railway, statsplus-live-shots; GET only)
Verdict: passed with one console note. Evidence: shots/production/*.png, observations.json (per route: console, API calls, button/select counts).
- /matchups (desktop+phone): GET /api/games/slate?date=2026-10-14 200; empty slate; 0 game-day buttons, 0 season selects; no console errors; no overflow.
- /matchups?date=2026-03-15 (desktop+phone): slate 200, 7 games listed, 0 jump buttons; no console errors.
- Search /?player_name=LeBron+James&game_filter=5 (desktop+phone): page renders, game logs 200, 0 Season select. GET /api/games/seasons returns 404 on production (endpoint not deployed); this surfaces two console errors ("Failed to load resource ... 404", "API request failed: 404"). Not a functional break; noted for the PR.
Limits: production has no 2026-27 schedule, so today's Slate is empty and new-field behaviour is not observable there; production runs the old backend, so this cannot prove the backend change.

## Limits
- The frozen QA seed has only 2025-26. The two-season case used a synthetic 2026-27 player_game_logs publication (LeBron's 5 latest 2025-26 rows relabelled, dates Oct 22-30 2026) composed in the disposable clone through PublicationService and a pointer cutover (journeys/seed.py). 2026-27 profile panels show "Failed to fetch data" because no 2026-27 diet data exists. Also e2e flow log-workspace.e2e.ts season journey covers the fixture path (not re-run here).
- API JSON captured via the same backend code in-process (Flask test client, auth bypass) against the same disposable clone, because the QA backend requires Firebase tokens.
- Select driven by keyboard (heading click, Tab, type-ahead "2"); helper has no select action.
- Phone assert-layout run on the slate page only; Search phone proofs have no overflow assertion (known 838px+ overflow on Search at 390px).
- Production check was not run through control-statsplus (no evidence.md from it); live-shots script copy with console/network observation added.
## Cleanup
Both QA sessions exited with owned runtime removed and local Postgres stopped; production Vite (port 5191) stopped, live-shots config/env removed, frontend tree clean.
