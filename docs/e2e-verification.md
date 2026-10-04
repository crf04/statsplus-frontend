# e2e adoption verification

Implementation: `4de976eb21633c76a59a5a4da89f080f47cb789a`; CI action pins and
replay formatting exclusion: `f520eda`. Base: `334f99b7e3623de460cb5142313ca54286d932ca`.
Frontend worktree: `/Users/chrisfu/statsplus-frontend-e2e`, branch `test/e2e-framework`.
No application source, existing browser fixture/spec, or Playwright config changed.

Verification tier: **Internal** (test infrastructure and coverage only). Additional
live QA and production checks were performed and recorded separately below.

## Owning checks

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
| `npm run test:flows`                                                                               | 110 passed: 55 deterministic cases × desktop/phone                              |
| `npx e2e list`                                                                                     | All flow/target pairs collected, including 16 optional agent cases              |
| `npx e2e login openai`                                                                             | Interactive browser authorization required; cancelled rather than blocking work |
| `npx e2e run e2e/flows/search.e2e.ts --tag agent --target desktop --output .e2e/agent-login-check` | Blocked: `MODEL_PROVIDER_FAILED`, no stored ChatGPT login                       |

The full e2e report is `.e2e/report.json`; Markdown/JUnit and failure artifacts
remain under `.e2e/`. Reports are ignored and uploaded by the new CI job.
Initial new-test failures were exact locator/visible-text mismatches, corrected
before the passing run. No application bug was confirmed, so there is no bug-fix PR.

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
`/tmp/e2e-review/`. A fresh follow-up review covers the changes and the new cases.
Agent variants remain unrun and unmutated because subscription login is absent.

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
