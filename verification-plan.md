# Issue 57 verification plan

Checkouts: coordination /Users/chrisfu/.t3/worktrees/statsplus/t3code-4ed26896 and isolated .statsplus/worktrees/{backend,frontend}, branch feat/57-last15-wait. Final SHAs will be pinned after implementation/review.

| Behavior | Plausible regression | Trigger and required evidence |
| --- | --- | --- |
| League withholding | A qualifying team still creates provider work while another has 14 or is absent | Backend collection-cycle tests with 29/30 and missing-team catalogs; assert zero L15 descriptors and no L15 failure/alert |
| Automatic release | Waiting state latches permanently or publishes short windows | Advance final team to 15 and run next cycle; assert ordinary publication with exactly 15 IDs per team |
| Stored unavailability | State is computed at read time or old L15 facts leak | Materialize waiting state then read Matchup/Targets; assert missing/insufficient_governed_games and empty L15 facts |
| Isolation | Season or unsupported play types acquire waiting reason | Assert Season status/reason/values unchanged and play_types L15 provider_window_unsupported |
| Human explanation | Current Matchup Base bypasses section reason helper | Frontend behavior test through Last 15 control; complete sentence visible, raw reason absent, future fallback preserved |
| Historical compatibility | New reason handling breaks existing historical sheets | Actual authenticated frontend to changed QA backend on historical matchup; inspect response and visible sheet, desktop/phone actions, reload |
| Failure/recovery | Empty or invalid slate becomes broken navigation | Existing helper journey: empty slate, invalid date 400, then valid date recovery |
| Production compatibility | Frontend fails against deployed payload | Separate read-only production helper journey, capture desktop/phone screenshots with live data |
| Targets | Withheld L15 throws or changes dense fallback | Backend resolution and frontend fit rendering tests; actual QA Targets journey if supported by snapshot |

Fresh-context Astra high Standards and Spec reviews must receive unedited parent and child specs and full diff including uncommitted changes. Reviewers mutate each new behavioral test in isolated review worktrees, restore, and report results. Material changes require re-review.

QA and production verdicts remain separate. Historical compatibility alone does not prove a live early-season waiting transition. Any unavailable live state is recorded explicitly; automated transition tests remain separate evidence. Inspect images and session cleanup before publishing evidence.
