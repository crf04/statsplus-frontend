**Spec PASS.** I put back all 13 surviving defects from the earlier mutation report, one at a time, and every one now makes its new test fail. Each test passed again once the defect was removed.

I made the changes only in `/tmp/statsplus-99/frontend-gap-review` at `e81985d`. Before mutating, the unchanged tree passed all 8 tests in `filter-panel.spec` and all 22 Jest tests. Every mutated run failed on the intended assertion; none failed from a compile error or crash.

| Mutation                                          | Test that failed                             | What it caught                                          |
| ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| Sign-in check removed from the saved-sets read    | signed-out shared readers…                   | 3 requests recorded where none were expected            |
| Sign-in check removed from the next-opponent read | same test                                    | same: 3 requests instead of none                        |
| "Most" tier `[1,10]`                              | most-allowed tier…                           | no "+" for ranks 1–8 (it asserts `rank_filter[]=8` too) |
| "+" never shows as added                          | most-allowed tier…, next opponent tiers…     | "+" stays enabled after adding                          |
| Explicit chart line ignored                       | season cells follow the explicit chart line… | the "(over)" cell is missing                            |
| Open saved set never marked                       | opening a Saved Filter Set marks…            | `" · open"` reads `none`                                |
| Picking a teammate only fills the box             | picking a teammate suggestion…               | no "with Anthony Davis on court" row                    |
| Season dedupe ignores the season                  | switching seasons…                           | second season request never sent                        |
| Cached-season check ignores the season            | switching seasons…                           | the old season's slider still showing                   |
| Decoder: rank-below-1 check removed               | rejects unusable contract values             | bad payload not refused                                 |
| Decoder: whole-number rank check removed          | rejects unusable contract values             | bad payload not refused                                 |
| Decoder: `team_filter` type check removed         | rejects unusable contract values             | bad payload not refused                                 |
| Playtype default maximum wrong                    | minimum-only playtype…                       | the 20–200 row is missing                               |

All the new tests check behaviour the spec asks for, not implementation details:

- **Signed-out:** story 43, "Saved Filter Sets absent" for signed-out readers.
- **"+" marked added:** "the '+' shows as added".
- **Strip follows the line:** story 22.
- **Open saved set marked:** story 34.
- **Teammate added on pick:** story 10.
- **Most tier:** "tier `[1, 8]` for 'most'".
- **Keep existing behaviour:** "Every control's encoding and validation stays as today" covers the playtype default and the season checks.

**Revisions and cleanup:**

- **Frontend tested:** `e81985dee6e1d0ac778d4a1a7ed5f2fcbe1d916b`.
- **Frontend original HEAD now:** `eaea1d04166605ce64fe1c7752872c0a020f1309`. The extra commit, "Record final mutation regression verification", changes only `docs/verification/issue-99`, so the application code and tests I mutated are identical.
- **Backend:** `ee311a6de9faad32c0693ba6fe115865f2e59dbe`.
- **Clean state:** the review tree and the original frontend both show a clean `git status`. The only leftover is the git-ignored `test-results/` folder in the review tree. My dev server on port 4183 is stopped. I did not touch 4173 or 5188, did not run the core-flows production-routing smoke test, and did not change any baseline or test.
- **Logs:** `/tmp/statsplus-99/gap-logs/`, one file per mutation plus the harness script `run.py`.
