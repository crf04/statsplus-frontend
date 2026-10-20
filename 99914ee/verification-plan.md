# Verification plan: replay at frontend#284 99914ee (master merged in, bringing fe#281's src/matchups/matchupApi.js)

The PR's own code is unchanged since 86dec93; the merge changes only the Matchup line_prices decoder (unknown providers
are skipped) plus its test, docs/testing.md and the e2e contract fixture. Replay of ../86dec93/verification-plan.md with the
same seed_lines.py, pinned helper copies (helper-pin, helper-pin-prod) and drive.py.

- QA: qa-posted-line-picker.jsonl unchanged (same journey SHA-256 74353a82). Backend: throwaway detached worktree at
  statsplus-backend origin/master 551ea33d (Python 3.12 venv from requirements-lock.txt).
- Production: prod-posted-line-picker.jsonl with one change (prod-journey-refocus.diff): before the `p` type-ahead that
  returns Line Type to PTS, click Line Value and Shift+Tab back to Line Type, the same refocus the journey already uses
  before the REB type-ahead. Without it the `p` press no longer reaches the select in production (Line Type stays REB);
  the identical diagnostic at 86dec93 fails the same way today (diag-prod-run-at-86dec93), so the change is environmental,
  not from this head. Expected values (Tatum Dabble 26.5, 1/16; Brown 20.5, 62/71) are unchanged and all passed.
- Matchup decoder (fe#281): one production desktop proof of BOS @ DET (0022600001, 2026-10-20) loading, whose
  /api/games/matchup body carries line_prices (prod-matchup.jsonl).

| Behavior | Regression it would catch | Trigger | Observable outcome |
| --- | --- | --- | --- |
| Everything in the 86dec93 plan | as before | as before | as before |
| Matchup page decodes production line_prices | the merged decoder rejects a live Matchup body | open /matchups?date=2026-10-20, click BOS @ DET | GET /api/games/matchup?game_id=0022600001 200, "What DET allows" heading and Matchup summary region render |
