# e2e adoption verification

Implementation: `4de976eb21633c76a59a5a4da89f080f47cb789a`; CI action pins and
replay formatting exclusion: `f520eda`. Base: `334f99b7e3623de460cb5142313ca54286d932ca`.
Frontend worktree: `/Users/chrisfu/statsplus-frontend-e2e`, branch `test/e2e-framework`.
No application source, existing browser fixture/spec, or Playwright config changed.

Verification tier: **Internal** (test infrastructure and coverage only). Additional
live QA and production checks were performed and recorded separately below.

## Merge order and standalone baseline

**Merge PR #157 before #155.** #155 depends on its repair of three existing
Playwright request-observation races; #155 does not contain that repair.
At the independently reviewed baseline `1366da1912e5625de5b9a14f5ef2265db04d9e6c`,
Playwright without retries produced **137 passed, 1 failed, 2 skipped**. The
failure was `clearing a control clears its parameter`. Green CI with retries
is not a clean standalone first-attempt result.

The initial adoption below had **55 deterministic journeys / 110 width cases**.
Two Matchup navigation journeys added at `905c8dd` brought the reviewed baseline
to **57 journeys / 114 width cases**. These are historical counts; the fix-round
results later in this document describe the strengthened suite.

## Review fix round 1 at `8c7f22a`

Worktree `/Users/chrisfu/statsplus-frontend-e2e`, branch `test/e2e-framework`,
revision `8c7f22a5e4ab344d81c64d3f04009ee39cec85aa`; Node 22.18.0.
This is #155 alone, with no #157 commit applied and no test retries.

| Command                                       | Result                                           |
| --------------------------------------------- | ------------------------------------------------ |
| `npm run lint`                                | Passed                                           |
| `npm run format:check`                        | Passed                                           |
| `npm run typecheck:e2e`                       | Passed                                           |
| `npm run build`                               | Passed                                           |
| `npm run test:ci`                             | 825 passed, 50 suites                            |
| `npm run test:flows`                          | 120 passed: 60 deterministic journeys × 2 widths |
| `npm run test:e2e -- --workers=2 --retries=0` | 137 passed, 1 failed, 2 intentional skips        |

The failing Playwright test in this run was `a season the panel cannot express
survives an unrelated apply`, another of the three request-observation races
repaired by #157. The independent `1366da1` run instead failed the clearing-control
test; both results are recorded, not hidden by retries. **Merge #157 first.**

The three added deterministic journeys cover ambiguous-player guidance, rendered
stats cards/per-36 averages, and clearing old rows while Apply is in flight.
Existing journeys now assert date controls, selection focus/pressed state/history,
Target through-date inclusivity and two-game fit isolation, dialog reset state,
table-scoped filter badges, reference clause rows, and one HTTP request per Apply.
No application code, shared HTTP fixture, or Playwright spec changed in #155.

Full gate logs are `/tmp/statsplus-fix-round1-155-gates/`.
The Score Matrix follow-up at `c48456b98a74d1fae7a72ca7926ad62647b6f4df`
reran all seven gates: lint, strict types, build, 825 Jest tests and 120 flow
cases passed; Playwright again had 137 passed, 1 failed, 2 skipped, this time
on `clearing a control clears its parameter`. Logs are
`/tmp/statsplus-fix-round1-155-final-gates/`. The draft evidence table initially
failed formatting; formatting was corrected and the final check passed after
completing the evidence. The only remaining gate failure is the #157-dependent
Playwright race. No retries were used in either Playwright run.
The [mutation report](e2e-review-round1.md) contains exact output, equivalent-mutant
rebuttals, and the [replayable mutation corpus](e2e-review-round1-mutations.json).
Existing QA/production evidence below remains historical; this Internal-tier
assertion repair does not change rendered application output or require new live
backend behavior. Optional agent/replay runs remain unverified for lack of login.

## Initial adoption checks at `4de976e`

Run from the frontend worktree with Node 22.18.0 (CI pins 22.14.0; package minimum 22.12):

| Command                                                                                            | Result                                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm ci`                                                                                           | Passed, including a clean reinstall after dependency additions                  |
| `npm run lint`                                                                                     | Passed; now includes TypeScript flow tests                                      |
| `npm run typecheck:e2e`                                                                            | Passed, strict TypeScript config and flow checking                              |
| `npm run format:check`                                                                             | Passed                                                                          |
| `npm run test:ci`                                                                                  | 825 tests passed                                                                |
| `npm run build`                                                                                    | Passed                                                                          |
| `npm run test:e2e -- --workers=2`                                                                  | 138 passed, 2 existing intentional skips                                        |
| `npm run test:flows`                                                                               | 110 passed at `4de976e`: 55 initial cases × desktop/phone                       |
| `npx e2e list`                                                                                     | All flow/target pairs collected, including 16 optional agent cases              |
| `npx e2e login openai`                                                                             | Interactive browser authorization required; cancelled rather than blocking work |
| `npx e2e run e2e/flows/search.e2e.ts --tag agent --target desktop --output .e2e/agent-login-check` | Blocked: `MODEL_PROVIDER_FAILED`, no stored ChatGPT login                       |

The full e2e report is `.e2e/report.json`; Markdown/JUnit and failure artifacts
remain under `.e2e/`. Reports are ignored and uploaded by the new CI job.
Initial new-test failures were exact locator/visible-text mismatches, corrected
before the passing run. No application bug was confirmed. Follow-up verification found a race in three existing
Playwright assertions; it is fixed separately on `test/wait-for-filter-requests`.

## Live verification

Coordination checkout: `/Users/chrisfu/.t3/worktrees/statsplus/t3code-be638cc6`.
The exact executed JSONL files and their hashes remain beside the evidence at
`/tmp/statsplus-e2e-evidence`; portable provenance is in `e2e-evidence.json`.

QA backend: `/Users/chrisfu/statsplus-backend-e2e-qa`, detached at
`c1f40b54cf7e0af881381e805f0fc4b91fa3ffca` (`origin/master` supplied for this task).
Its disposable database uses frozen snapshot
`3fe69266e135d9ed9e6f671d01e7034c7d529a6ee3a9fa6395851b003ee222f5`.
Real Firebase authentication was restored before each journey.

The initial shared backend checkout was on older `ac61b6661fc0d68dd554c2ddd66e879ef9d2003f`.
It lacked `/api/players/next-opponent` and failed the Search sample-size check.
Selecting the supplied backend revision resolved both failures without code changes:

```sh
STATSPLUS_FRONTEND_ROOT=/Users/chrisfu/statsplus-frontend-e2e \
STATSPLUS_BACKEND_ROOT=/Users/chrisfu/statsplus-backend-e2e-qa \
python3 scripts/check.py
```

Result: passed, including contract and verification-helper checks.

Every live command used this helper from the coordination checkout:

```sh
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs \
  --frontend /Users/chrisfu/statsplus-frontend-e2e \
  --backend /Users/chrisfu/statsplus-backend-e2e-qa \
  --port 5193 --out /tmp/statsplus-e2e-evidence/qa-search-pinned \
  < /tmp/statsplus-e2e-evidence/search.jsonl
```

The other QA runs used the same arguments with these exact input/output substitutions:

| Input                        | Output directory   | Result                                                                            |
| ---------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `search.jsonl`               | `qa-search-pinned` | 41 steps passed: shared URL, edit, reload, phone, refusal, browse, return         |
| `matchups.jsonl`             | `qa-matchups`      | 41 steps passed: slate/detail, stat controls, reload, phone, empty/error recovery |
| `qa-saved-filter-sets.jsonl` | `qa-saved`         | 24 steps passed: create/open/rename/delete; desktop and phone                     |
| `qa-targets.jsonl`           | `qa-targets`       | 30 steps passed: sample/Lab/create/list/delete; desktop and phone                 |

Production runs added `--environment production`, used credential-source backend
`/Users/chrisfu/statsplus-backend`, port `5194`, and the following inputs/outputs:

| Input            | Output directory      | Result          |
| ---------------- | --------------------- | --------------- |
| `matchups.jsonl` | `production-matchups` | 41 steps passed |
| `search.jsonl`   | `production-search`   | 41 steps passed |

Production reads went to deployed Railway through the local frontend transport;
no local backend SHA identifies the deployed code. The helper blocked non-read
API requests. QA writes ran only against disposable databases. Each session
reported `cleanedUp: true`, its private runtime was absent afterward, and its
screenshots/ARIA/JSON/video evidence remained. Initial failed QA also cleaned up.

Live manifests pin the precommit frontend HEAD and full working-file fingerprint.
Application source at those fingerprints is identical to this PR; subsequent
changes concern tests, CI and documentation only.

Viewport screenshots were additionally captured with the live-shots skill:

```sh
node /Users/chrisfu/.agents/skills/statsplus-live-shots/live-shots.mjs \
  --dir /Users/chrisfu/statsplus-frontend-e2e \
  --backend-dir /Users/chrisfu/statsplus-backend --port 5195 \
  --out /tmp/statsplus-e2e-viewport-shots --wait-for '.defense-sheet' \
  /matchups/0022501174
```

These production-backed desktop (1440×900) and phone (390×844) screenshots are
committed under `docs/screenshots/e2e-adoption/`. Both were visually inspected.

## Independent review and follow-up

Claude Sonnet 5.5 reviewed implementation `4de976e` in an isolated worktree and
ran 120 distinct application/transport mutations. Every original deterministic
case failed under at least one relevant mutation. Six other mutations survived,
which exposed gaps in assertions rather than application defects:

| Finding                                            | Correction                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Only the middle landing example was exercised      | Click and assert all three literal query examples                        |
| Back returned through a newly pushed history entry | Exercise browser Back directly from the reference before the return link |
| Reload concealed an unclosed saved-sets modal      | Assert dismissal before reload                                           |
| Signed-out landing was not checked for saved sets  | Anchor on rendered landing content, then check the button is absent      |
| Finish-cycle selection matched its default         | Select and assert the non-default `no_game` request value                |
| Target resolution used the fixture's default date  | Add a MIL Target and verify its fit on the distinct historical date      |

The reviewer proved the proposed corrections kill all six survivors and preserve
330/330 repeated test runs in a scratch copy. The implementation also adds two
Matchup navigation cases (player → Log Workspace and Back to slate), updates the
agent completion gate, removes unused `isPhone` and direct `zod`, and uses a
10-second assertion timeout to allow cold browser startup under load.

The original mutation table is in [e2e-mutation-audit.md](e2e-mutation-audit.md).
Detailed first-round reports, mutation definitions and logs remain under
`/tmp/e2e-review/`. A fresh Claude Sonnet 5.5 follow-up found no material findings at `905c8dd`.
It passed the 114-case baseline and 342/342 cases under `CI=1 --repeat-each 3`.
All 14 follow-up mutations were killed at both widths (28/28); failures were
at the intended behavioral assertions, and the review worktree was restored clean.
The final report and mutation table are appended to the committed audit.
Agent variants remain unrun and unmutated because subscription login is absent.

## Follow-up verification at `905c8dd`

`npm ci`, lint, formatting, strict type checking, 825 Jest tests and build passed.
`npm run test:flows` passed **114/114**. The coordination gate passed with the
pinned QA backend above.

Live `matchup-links-verified.jsonl` passed 19 steps at frontend
`905c8ddd0f2ea5f0d1fe32ad066f8dc27da50726`, using the same QA helper arguments and
output `qa-matchup-links-verified`. Clicking Jeremiah Fears opened his Game Logs
and sent the matching request; at phone width Back to slate restored the date
controls and selecting April 10 rendered NOP @ BOS with a successful slate read.
The initial exploratory expectation of an empty current slate was incorrect:
QA freezes today to March 11, 2026. All exploratory and final sessions cleaned up.

A concurrent Playwright run suffered React dependency-cache loading errors while
review worktrees shared `node_modules`; it was interrupted. A rerun with a private
Vite cache cleared those errors but exposed two pre-existing request-observation
races (136 passed, 2 failed, 2 intentional skips). A focused single-worker repeat
reproduced one race (19 passed, 1 failed). Network traces show the correct Apply
request arriving after the tests prematurely inspect an earlier season read.
The isolated fix and regression verification are delivered separately; this PR
does not alter the existing Playwright specs. Local logs:
`/tmp/statsplus-e2e-round2-playwright-final.log` and
`/tmp/statsplus-e2e-request-race-red.log`.

The private-cache rerun used a temporary Vite config importing this checkout's
`vite.config.mjs` and overriding only `cacheDir` to
`/tmp/statsplus-e2e-gate-vite-cache`, then:

```sh
REACT_APP_E2E_MODE=true npm start -- --config /tmp/statsplus-e2e-gate.vite.mjs --host 127.0.0.1 --port 4173 --strictPort
npm run test:e2e -- --workers=2
npm run test:e2e -- --workers=1 --grep 'a season the panel cannot express|removing every self filter' --repeat-each=10
```

An intermediate attempt with `E2E_BASE_URL=http://127.0.0.1:4174` unnecessarily
enabled the deployed-only API smoke against the local app; it was interrupted
and replaced by the default-port command above. No product change was needed
for either harness setup error.

## Unmet checks and next action

Agent goals are written and followed by exact locator outcomes, but have not run
successfully or produced replay recordings. Complete the private login, then run:

```sh
cd /Users/chrisfu/statsplus-frontend-e2e
npx e2e login openai
npm run test:flows:agent
npm run test:flows:replay
```

Review generated `e2e/replay-cache/` entries before committing them. Never commit
OAuth credentials. A missing recording can still invoke the model with strict
cache enabled; it is not a credential-free gate until recordings exist.

Real Google popup login, enabled paid AI/DFS/injury/Redis integration behavior,
and live administrator mutations were not exercised. Their applicable UI/HTTP
branches are covered by hermetic tests; the QA account has no admin claims.
The PR remains draft. No PR was merged.

GitHub CI at `14bb5b25e086c009830e6d026ddb8436b90a6b78` passed validation,
Playwright and e2e flows; Vercel deployment succeeded. The two deployment-smoke
jobs were intentionally skipped. [CI run](https://github.com/crf04/statsplus-frontend/actions/runs/37238415122).
