# Issue 99 verification evidence

Implementation verified: frontend `ecb66a25eb8cde2cd416a1609a0a632d55993ad7`,
backend `ee311a6de9faad32c0693ba6fe115865f2e59dbe`, coordination `1c08ac3`.
The final test-only revision is `e81985de`; application source is unchanged from
`ecb66a25`. This directory records evidence separately from application changes.

## Results

| Check                                      | Verdict                                          | Evidence                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend completion gate                   | Passed                                           | lint, formatting, 825 Jest tests, build, 136 E2E tests; 2 production-only tests skipped in the hermetic suite                                                                 |
| Backend completion gate                    | Passed                                           | 5,145 tests, 85.40% coverage, migration replay and demo validation                                                                                                            |
| Coordination gate                          | Passed                                           | `scripts/check.py` with both implementation roots selected                                                                                                                    |
| Frozen J parity                            | Passed                                           | 12 checks, including seven screenshots with the 50-pixel tolerance unchanged                                                                                                  |
| Authenticated isolated QA                  | Passed for executed coverage                     | Apply/back, literal 5/10/15 of 60 games, 390px interactions, Own stat line, inline save/reload/reopen, refused-link recovery                                                  |
| Production read-only compatibility         | Partial                                          | Existing game-log requests and phone Apply passed; new next-opponent read returned 404 before backend deployment                                                              |
| Claude Opus 5.5 Standards and Spec reviews | Passed                                           | Fresh contexts received the unedited issue and complete diffs; material findings resolved and reviewed again                                                                  |
| Mutation review                            | Passed for addressed rank/ratio/schedule defects | Reversed ranks, wrong rank source, ties, reduced populations, exhibition guard, All-Star exclusion, ratios, percentages, units, and five-team tier clamp each caused failures |

The executed JSONL journeys, sanitized action results, source manifests, artifact hashes, screenshots,
accessibility snapshots and response status summaries are adjacent. Authentication
storage, credentials and tokens are excluded. Full private run logs and video
remain under `/tmp/statsplus-99/` on the verification machine.

## Commands

Run the live commands from the coordination checkout, selecting the implementation
worktrees explicitly. The production command uses the original Railway-linked
backend checkout only as a credential source; its HEAD does not identify deployed
Railway code.

```sh
npm run lint
npm run format:check
npm run test:ci
npm run build
npm run test:e2e -- --workers=4
# Backend owning gate:
./scripts/check.sh
# Coordination gate:
STATSPLUS_BACKEND_ROOT=/Users/chrisfu/statsplus-backend-99 STATSPLUS_FRONTEND_ROOT=/Users/chrisfu/statsplus-frontend-99 python3 scripts/check.py
# Isolated authenticated QA:
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs --backend /Users/chrisfu/statsplus-backend-99 --frontend /Users/chrisfu/statsplus-frontend-99 < qa-filter-panel.jsonl
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs --backend /Users/chrisfu/statsplus-backend-99 --frontend /Users/chrisfu/statsplus-frontend-99 < qa-inline-saved.jsonl
# Read-only deployed compatibility:
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs --environment production --backend /Users/chrisfu/statsplus-backend --frontend /Users/chrisfu/statsplus-frontend-99 < production-filter-panel.jsonl
```

The command files above are in this evidence directory; use their absolute paths
when invoking the helper from coordination.

## Screenshots

Production: [desktop](filter-panel-production-desktop.png) and
[phone after Apply](filter-panel-production-phone-applied.png).

Isolated QA: [desktop](filter-panel-qa-desktop.png),
[phone after Apply](filter-panel-qa-phone-applied.png),
[phone Own stat line](filter-panel-qa-phone-own-stat.png),
[new inline save](inline-saved-created-desktop.png),
[phone saved URL reopened](inline-saved-opened-phone.png), and
[refused-link recovery](filter-panel-refused-link-phone.png).

## Limits and rollout

The sports seed has no future scheduled game for the tested player, so live QA
checks the null-opponent state. Scheduled-opponent add-tier behavior is covered
by the deterministic browser fixture and seeded Flask route-to-game-log tests.
QA disables Redis, paid AI fallback, DFS and injury providers.

The backend must merge and deploy before the frontend. Keep the application PRs
in draft until the affected production next-opponent journey passes after that
deployment. No application was deployed or merged during this task.

The owner approved regenerating screenshots exclusively from the frozen reference
with the Vercel feedback widget hidden. The parity kit README records that command;
no baselines were generated from this implementation.
