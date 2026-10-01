# Issue 99 Boundary verification plan

Pinned implementation worktrees: /Users/chrisfu/statsplus-frontend-99 and /Users/chrisfu/statsplus-backend-99. Record final HEADs and working file hashes at launch.

| Behavior                   | Regression                                 | User action                                                                                | Required observable proof                                                            |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Filter sentence and drafts | URL and panel drift                        | Open shared last-5 link, remove Last N, choose 10, Apply, Back                             | Literal URL parameters and visible sample change then restore                        |
| Own stat line              | Stat picker waits for season               | Open editor while unfiltered response delayed (deterministic test), then choose stat in QA | Fixed stat options available; actual season bounds once loaded                       |
| Season strip               | Counts echo request instead of actual rows | Change Last N and current line                                                             | Row-based N of M, over/under cells, no stale season after player changes             |
| Next opponent              | Wrong rank direction/ties                  | Open scheduled player's workspace; add extreme tier                                        | Returned tier includes opponent through actual game-log route; visible badge and URL |
| No scheduled game          | Invented opponent                          | Open offseason player workspace                                                            | next_game null and opponent block absent                                             |
| Saved Filter Sets          | Inline rows don't navigate                 | Save last-5 query in isolated QA, change query, open saved row                             | Saved URL and matching sample restored; persistence after reload                     |
| Phone                      | Clipped controls/sideways scroll           | Repeat Last N and Apply at 390px                                                           | Updated URL/sample, all blocks in flow, no overflow                                  |
| Recovery                   | Refused link leaves save enabled           | Open invalid game_filter                                                                   | Visible error and account save unavailable                                           |
| Reference parity           | Styles re-derived or baselines replaced    | Execute immutable J kit                                                                    | Seven screenshots <=50 diff pixels plus all behavioral checks; baselines unchanged   |

QA uses isolated PostgreSQL seed and real Firebase auth. Run read-only production compatibility separately. The undeployed new route cannot be certified against production until backend deploy; record the missing production route as an explicit limit and retain draft PRs if required checks are unmet. No deployment or merge is authorized by this task.
