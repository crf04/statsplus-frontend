# Final live QA plan — statsplus#103/#104 (rerun of affected sessions on final revisions)

Revisions: coordination b97e927d; frontend frontend-recovery 452210b (feat/104-backtest-seasons-recovery); backend backend-qa detached
788b4262 (.venv -> backend/.venv; deps unchanged since 18fe9957: delta touches app/services/backtest_season.py, target_backtest.py, docs, tests);
MCP mcp 044bc96 (feat/104-mcp-backtest-seasons, contains #103 lower da3970b), stdio local. Browser: verify-statsplus helper
(T3 preview_status available:false; preview_open tab_1 available:false). FA/FP = unmodified helper; FB = helper-pin copy
(+NBA_CURRENT_SEASON=2026-27 only, same diff/hashes as the 10:23 pin). Driver: drive.py (hooks run between browser steps; executed JSONL saved).
Only disposable QA clones are written. Redis is disabled in QA, so the backend's cache-hit readability path (788b4262) is not exercised here.

| # | Behavior (changed since last QA) | Regression it catches | Trigger | Observable |
|---|---|---|---|---|
| FA1 | Published default, defender chosen by name | roster/season wrong | save sample, add defender (P, Enter) | 2025-26 pressed, preview 200 |
| FA2 | Refused 2024-25 presentation | stale 2025-26 numbers beside refusal; "read.Retry" | click 2024-25 | 503; no Backtest summary; Retry button; alert spaced; defender keeps name "· roster unavailable" (aria) |
| FA3 | Incomplete draft after refusal (452210b) | prior season revived | Remove Qualifier 1 | no summary, "Complete the Qualifiers" |
| FA4/5 | Phone refusal + recovery | phone stale numbers / layout | toggle at 390px | summary hidden then back; assert-layout |
| FA6 | Saved card label desktop/phone | unlabelled / empty | All Targets | batch 200, card summary, no "Nobody qualifying" |
| FA-API | Contract (default/2024 503/2023 400/null 400/roster 503) | | direct authenticated calls | api/fa-* |
| FA-MCP | ORL canonical tricode; empty summary worded as limit; season; needs_choice; bad slice; nothing saved | ORL rejected; silent empty table | mcp stdio | mcp/fa-published.json, list before=after |
| FB1/2 | Fallback cards + Lab note, defender | no fallback label | /targets, save, Lab | note + 2025-26 pressed |
| FB3/5 | Refused explicit 2026-27 desktop/phone | fallback note + 2025-26 numbers beside refusal | click 2026-27 | 503; note hidden; summary hidden; Retry |
| FB4 | Explicit 2025-26 | requested | click 2025-26 | 200; summary; note hidden |
| FB6/7 | Default restored on reload; saved card desktop/phone | | reload; All Targets | note; batch 200 |
| FB-API/MCP | fallback/explicit/2026 503; ORL; empty | | | api/fb-*, mcp/fb-fallback |
| FB8/9 | Missing retained 2025-26 history row -> unavailable (card, Lab, API GET+batch, MCP) | empty Backtest / "nobody fits" | DELETE row in disposable clone, reload | 503 everywhere, no empty-state copy |
| FP | Production saved cards desktop/phone (read-only); Lab POST refused by guard | decoder breaks on deployed backend | --environment production | batch 200; Lab untested (guard) |
