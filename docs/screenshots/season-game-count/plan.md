# Verification plan — season_game_count (crf04/statsplus#88)

Tier: **Boundary** — changes the GET /api/games/game_logs response and the frontend decoder.

Revisions
- backend  crf04/statsplus-backend#306  claude/season-game-count  9ce9b45ff5a3d23f7516d7f46aef892a5ac433cf
- frontend crf04/statsplus-frontend#144 claude/season-game-count fe93e148399c29b16bdad60c0bbd693eb4adf955
- coordination check: `python3 scripts/check.py` (worktrees selected via STATSPLUS_*_ROOT) — passed

| # | Behavior | Plausible regression | Trigger | Observable outcome that fails on regression |
|---|----------|---------------------|---------|---------------------------------------------|
| a | Shared link shows "N of M games" | field missing / not decoded / M counts filtered rows | open `/?player_name=LeBron+James&game_filter=5` (QA) | heading Game Logs, 200 game_logs with game_filter=5, card text "5 of M games" with M>5; desktop + phone proof, layout ok |
| b | M independent of filters | season_game_count computed after filtering | clear Last N games, Apply Filters | card "M of M games", same M as (a); tbody row count == M |
| c | Narrow filter keeps M; no stale count while loading | stale sampleSize rendered during fetch; M shrinks with filter | Date Filter set near LeBron's last game (few games), then a date after it (0 games), Apply Filters | "K of M games" / "0 of M games", same M; in-flight state shows no count (best effort: snapshot immediately after click + video) |
| d | NL path shows the count | NL route bypasses decoder | from `/`, type "LeBron James last 10 games", Enter | 200 game_logs, "10 of M games", same M |
| p | Graceful degrade vs deployed backend (no field) | "undefined"/"of null"/crash when field absent | production mode, open shared link | "5 games" (no "of"), no errors, assert-layout passes; desktop + phone proof |

Smoke: launch doctor + real Firebase session in both modes.
Failure/recovery: absent field (production); zero-result filter (c).
Not covered: invalid (non-integer/negative) season_game_count from a live backend — unit tests only (gameLogsApi.test.js).

## Amendment (2026-09-24, run 2)
Run 1 (`qa/`) stopped at step 8: phone `assert-layout` failed. The same check fails on the base frontend
838a104 against the same backend and data (`diag-layout-base/`, full-page phone PNG 411px wide; head 415px).
This overflow already exists and #144 did not cause it. With the user's approval it is recorded as a limitation, and run 2 (`qa-run2/`) and
production omit `assert-layout` (it ends the session). Phone proofs are still captured and inspected.
