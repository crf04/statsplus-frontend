# e2e flow coverage

The e2e 0.20 runner (`@e2e-dev/web` 0.14) complements the existing Playwright gate. Both drive the real
React app through the same hermetic HTTP contract and development-only auth
adapter; neither proves Firebase popup login or the deployed backend. Every new
deterministic case runs at 1440×900 and 390×844. Phone means responsive browser
width, not touch emulation.

## Run

Requires Node 22.22.3+ on Node 22, or Node 24.8+. CI pins 22.22.3.

```sh
nvm install               # reads .nvmrc; then nvm use in later shells
npm ci
npx playwright install chromium
npx e2e-web install chromium
npx e2e list               # load config and discover test/target pairs
npx e2e run smoke --tag smoke --output .e2e/doctor
npm run test:e2e           # existing Playwright suite
npm run test:flows         # deterministic e2e, both widths, no model credentials
npx e2e login openai       # personal ChatGPT subscription, browser authorization
npm run test:flows:agent   # agent goals with exact outcome assertions
npm run test:flows:replay  # replay recordings; stale entries fail
npm run test:flows:all     # deterministic and agent paths together
```

The configured model is `chatgpt('gpt-6-luna')` from `e2e/oauth/chatgpt`.
If browser login cannot finish, run `npx e2e login openai --device` yourself.
Credentials stay in the runner's private user configuration, never this repository.
Agent goals are tagged `agent` and followed by locator assertions. The runner
records verified actions in `e2e/replay-cache/`; review and commit its generated
recordings after a successful authorized run. Never manufacture cache entries.
`--strict-cache` rejects stale recordings, but a never-recorded goal still needs
a live model. No recordings were available at adoption because login required
the user's interactive authorization.

CI adds an independent `e2e flows` job with the engine's own Chromium installation,
JSON/JUnit/Markdown reports and failure artifacts. It runs the deterministic
suite on every PR without subscription credentials. Agent runs stay local until
recordings have been made and reviewed. The existing `validate` and `E2E` jobs,
retain their existing tests; every CI job now uses the runner-compatible Node version. `.cursor/mcp.json`
is local editor registration and ignored; `.mcp.json` and the upstream e2e skill
are shared setup.

`npx e2e models openai` checks whether a ChatGPT login is usable; 0.20 has no
`login status` command. No stored login is required by `test:flows`.

The verification Doctor uses `flows/smoke.e2e.ts` (`smoke` tag): it opens Search
and pins the CourtAI navigation and landing heading. `npx e2e mcp` serves live
MCP sessions; `npx e2e explore` accepts `--output` but requires model login.
Runs keep their reports and screenshots under `<output>/results/`; use a unique
`--output` directory to retain a proof before starting another run. CI uploads
`.e2e/results/`. The bundled upstream skill matches the installed 0.20 package.

The two Doctor screenshots in `screenshots/e2e-adoption/doctor-*.png` are
hermetic signed-out desktop/phone evidence. Historical `production-*.png` files
remain separately labelled production evidence; they are not current proofs.

## Flow map

Routes are from `src/App.js`; the six research areas also match the coordination
`verify-statsplus/features` map. Paths below are relative to `e2e/`.

| User flow                                                                                                                                                                       | e2e coverage                                                       | Retained deeper Playwright coverage                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `/`: sign in/out, prose query, ambiguous player, rejection/retry, shared link and return                                                                                        | `flows/search.e2e.ts`                                              | `specs/core-flows.spec.js`                                                                            |
| `/`: browse, structured filters, one request per Apply, pending rows, Back, refused URL, empty/error/reload                                                                     | `flows/log-workspace.e2e.ts`                                       | `specs/core-flows.spec.js`, `filter-panel.spec.js`, `filter-panel-parity.spec.js`                     |
| Log Workspace analytics, charts, comparisons, date/timezone, player/season switching                                                                                            | `flows/log-workspace.e2e.ts` (rows, filtering, cards and averages) | `specs/p1-analytics.spec.js`, `player-profile-charts.spec.js`, `core-flows.spec.js`                   |
| `/help`: clauses, examples, draft retention, reload, Back                                                                                                                       | `flows/query-reference.e2e.ts`                                     | `specs/core-flows.spec.js`                                                                            |
| Saved Filter Sets: save, duplicate refusal, Cancel/reopen resets, reload, rename, delete, empty/auth                                                                            | `flows/saved-filter-sets.e2e.ts`                                   | `specs/core-flows.spec.js`, `filter-panel.spec.js`                                                    |
| `/matchups`: dates, games, empty/error/recovery, invalid dates, auth                                                                                                            | `flows/slates.e2e.ts`                                              | `specs/slate.spec.js`                                                                                 |
| `/matchups/:gameId`: live and historical sheets, stat/team changes, selection logs, player-log handoff, return to slate, deep links, close, empty/error                         | `flows/matchups.e2e.ts`                                            | `specs/matchup-detail.spec.js` (windows, deviations, sorting, freshness, keyboard, selection handoff) |
| Defense Sheet capture into a Target                                                                                                                                             | `flows/targets.e2e.ts`                                             | `specs/matchup-detail.spec.js`                                                                        |
| `/targets`, `/targets/:targetId`: samples, create/edit/revert/delete, Lab, Backtest, logs handoff, Conditions, grading preferences, Slate fits, context/retry, empty/error/auth | `flows/targets.e2e.ts`                                             | `specs/targets.spec.js`                                                                               |
| `/operations`, `/admin/operations`: visitor/reader denial, admin health, every exposed mutation, confirmation, retry, stale/empty diagnostics                                   | `flows/operations.e2e.ts`                                          | `specs/operations-console.spec.js`                                                                    |
| Unknown URL falls back to Search                                                                                                                                                | `flows/search.e2e.ts`                                              | `specs/slate.spec.js`                                                                                 |
| Production route assets, authenticated API routing, protected-preview credential handling                                                                                       | existing runner retained                                           | `specs/route-assets.spec.js`, `deployed-smoke-config.spec.js`, `core-flows.spec.js`                   |

Keep Playwright alongside e2e for its established screenshot baselines, browser-clock
control and full mobile device emulation. Existing request race/cancellation,
chart hover, HTTP rejection and deployment tests also remain valuable and are
not replaced by a short happy-path test. The disjoint `*.spec.js` and `*.e2e.ts`
globs keep collection isolated. `flows/support/courtai.ts` adapts only the route
and request interfaces; the application contract remains in `fixtures/courtai.js`.

## Verification limits

Use the coordination verification skill for real authenticated integration and
read-only production checks. Its pinned backend must be the intended revision;
a shared checkout on an older revision can fail otherwise-current contracts.
Never run the QA write journeys against production. QA disables paid AI fallback,
Redis, DFS and injury providers; those require separate enabled integration checks.
Operations mutations here are hermetic: the QA identity is not an administrator.
The Google popup and live model goals require interactive account authorization.

This is Internal-tier adoption: application source, requests, responses and rendered
output are unchanged. PR evidence records the owning gates and additional live QA
and production checks separately. Review the runner reports for the exact cases;
passing the deterministic suite does not imply the agent or live provider paths passed.
