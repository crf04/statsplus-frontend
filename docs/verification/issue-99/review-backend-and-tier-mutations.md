**PASS.** The last open Spec finding (the next-opponent route returning 500 for a non-NBA opponent) is resolved, and I found no regressions in this round.

**Revisions:** frontend is at `ecb66a25`, backend at `ee311a6d`. Both original worktrees and both delta-review trees are on those commits with nothing modified or untracked.

**Backend mutations** (`pytest --no-cov tests/routes/test_next_opponent.py`, 16 pass before mutating): each mutation was killed, and each for the intended reason.

| Mutation                                         | Test that failed                                                 | What it saw                                 |
| ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------- |
| Remove the NBA-team guard                        | `test_exhibition_opponent_preserves_next_game_without_nba_ranks` | `500 == 200`                                |
| Turn off the All-Star filter                     | `test_next_game_ignores_past_finished_and_postponed_events`      | picked `0032500403` instead of `0022500500` |
| `vs_league_pct=None`                             | `test_profile_ratios_percentages_and_units`                      | `None` vs `93.548…`                         |
| Return the raw value instead of the league ratio | same test                                                        | `2.0` vs `1.9355…`                          |
| `unit="count"` for every stat                    | same test                                                        | `'count'` vs `'league_ratio'`               |

After restoring the source, `test_next_opponent.py` plus `test_team_stats.py` pass 29/29.

**Frontend clamp mutation:** I ran Vite on 127.0.0.1:4182 with `REACT_APP_E2E_MODE=true` and `E2E_BASE_URL` pointing at it, and ran `filter-panel.spec.js --project chromium --grep "fewer than eight"`. The matching test is "a bottom tier with fewer than eight ranked teams remains a valid inclusive filter".

- **Before mutating:** 1 passed.
- **Without `Math.max(1, …)`:** it failed. It timed out waiting for the button `Add teams ranked 1–5 in Isolation`.
- **After restoring:** 1 passed.

I stopped the server and confirmed nothing is listening on 4182.

**Spec note, not a finding:** the spec's fewest tier is `[ranked_teams − 7, ranked_teams]`, which gives `[-2, 5]` when only 5 teams are ranked. Clamping it to `[1, 5]` is the only valid reading, and the tier still includes the opponent, as user story 29 requires.

**Resolved since the last report:** the backend now returns an exhibition opponent with `opponent_ranks: []` instead of a 500. The tests now pin the league ratio, `vs_league_pct` and unit for each stat, and an All-Star game is never chosen as the next game. The frontend bottom tier is clamped, with a browser test that fails without the clamp.

Logs are in `/tmp/statsplus-99/delta-mut/`.
