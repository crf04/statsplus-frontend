**Approve. I found nothing that needs fixing.** The patch is correct, as small as it can be, and fixes the clock dependency at the right place.

**Mutation check.** I faked `date.today()` in `app.config.settings` to return 2026-10-01 and compared runs with and without the patch. The working tree is back to just your 2-line diff, and the temporary stash entry has been dropped.

| Patch    | Clock               | `tests/test_dfs_routes.py`                                                                                                                                            |
| -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reverted | October             | **3 failed**, 56 passed: `test_a_complete_board_is_served_exactly`, `test_a_mixed_partial_and_stale_board_is_served`, `test_an_empty_complete_board_is_not_an_outage` |
| Reverted | Real clock (Sep 30) | 59 passed                                                                                                                                                             |
| Applied  | October             | 59 passed                                                                                                                                                             |
| Applied  | Real clock          | 59 passed                                                                                                                                                             |

- **Full suite with the October clock and the patch:** 5145 passed, so no other test depends on that season default.
- **`./scripts/check.sh` with the patch:** passes (5145 passed, 85.40% coverage, migrations and the demo database check fine).

**Correctness**

- The cause is as you described. `NBASeasonSettings.current_season` comes from `current_nba_season()`, which moves to the next season in October (`app/config/settings.py:66`). The DFS query uses `settings.nba.current_season` when the request gives no season (`app/services/dfs_board_query.py:77`). All three fixtures (`tests/fixtures/dfs_board/{complete,mixed_partial_stale,empty}.json`) contain `"2025-26"`, which is right for August 2026.
- Every client in the file is built through `board_settings()`, including the `enabled=False` and parametrized cases, so the one change covers them all.
- No runtime code changed. The October rollover itself is correct product behaviour, and the fix leaves it alone.

**Standards**

- Pinning the season through settings matches existing tests, e.g. `tests/test_nba_stats_adapter.py:82` uses the same literal and `tests/test_target_resolution.py:1648` uses a pinned constant. It also keeps tests offline and free of the wall clock without a time-freezing library.

**Two things to know, neither blocking:**

- `current_nba_season()` uses the machine's local date, not UTC. That's why CI, on UTC, failed before a Pacific-time machine would.
- The pasted issue (the filter panel and the next-opponent route) doesn't apply to this diff. It's a test-only CI fix, so I didn't check it against the spec.
