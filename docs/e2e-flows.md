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

## Fixture bridge for exploration and MCP

The flow runner starts `node e2e/bridge/server.mjs {port}` on loopback using
its port-0 allocation. The bridge serves Vite and `/api/*` on the same origin;
it never proxies requests. The shared `e2e/fixtures/courtai-contract.mjs`
contract also backs Playwright and scripted browser routes. Unknown API paths
return 501. A fixture cookie plus the disposable E2E bearer is required;
reader cookies cannot access `/api/admin/*`. No Firebase credentials are used.
The bridge overrides local API/Firebase environment settings, removes remote
font links, and applies a same-origin resource CSP. This is a development-only
fixture service, never a deployment entry point.

`bugbash.setup.e2e.ts` declares `bb-reader` and `bb-admin`. Each setup visits
`/__fixture/bootstrap/reader` or `/__fixture/bootstrap/admin`, proves the UI
gate and seeded account state, then saves storage **and the fixture cookie**.
Each bootstrap creates a new in-memory contract; Saved Filter Sets, Targets,
and simulated Operations jobs survive reloads with that cookie but never leak
to another bootstrap. Fresh `e2e explore --session …` invocations run their
setup independently, even on the same bridge. Teardown closes the owned Vite
and HTTP server and discards its accounts.

The seeded games are `0022500584` (January 15, 2026, LAL at BOS) and
`0022501082` (March 29, 2026, historical LAC at MIL). Saved Filter Sets and
Targets start empty. Target preview/backtest answers reuse the same tiny
fixture composition as scripted flows. Operations diagnostics are seeded;
confirmations only enqueue simulated jobs in that account's memory. Dates,
statistics and query interpretation are fixtures, not live provider coverage.

The tracked `e2e.bugbash.config.ts` supplies the bridge, personas, fixture
context, desktop and phone targets, and browser resource auditing. Run one
charter per invocation, with fresh output paths:

```bash
export PATH=/opt/homebrew/opt/node/bin:$PATH # macOS Homebrew Node, if needed
E2E_BRIDGE_LOG=.e2e/bugbash/search-input-desktop-network.jsonl \
  npx e2e explore 'Starting at / as the fixture reader, submit an empty query, 300 characters, unicode, and leading spaces; report lost input or failures that cannot be corrected and retried.' \
  --config e2e.bugbash.config.ts --target desktop --agent fuzzer \
  --session bb-reader --max-steps 3 --trace on --video \
  --output .e2e/bugbash/search-input-desktop
```

Use `bb-reader` for `search-input`, `workspace-apply`, `slate-dates`,
`matchup-selection`, `saved-filter-state`, and `target-draft`; use `bb-admin`
for `operations-confirm`. Public charters need no session. Findings are model
claims: preserve the log's Assessment and Findings, including zero findings,
before any separately authorized triage. Phone is a viewport, not touch.

For live MCP, launch `npx e2e mcp --config e2e.bugbash.config.ts`, then
`open_session` with `target: "desktop"` (or `"phone"`). MCP has no saved-session
option: use its `navigate` tool to visit `/__fixture/bootstrap/reader` or
`/__fixture/bootstrap/admin`, then observe the dated Slate or Operations
Console. Use `close_session` when finished. Navigating to a bootstrap again
creates a fresh account; it is not a resume URL. A manual bridge can also be
started with `node e2e/bridge/server.mjs 0`; it prints its allocated origin and
closes on SIGINT/SIGTERM/SIGHUP.

`E2E_BRIDGE_LOG` names a per-invocation log under an ignored directory (default
`.e2e/logs/bugbash-<target>.log`). Its JSON lines contain incoming HTTP origin,
method, path and status, plus `browser-resource` origins/paths from browser
Resource Timing and CSP violations (`blocked: true`). Headers, bodies and
cookies are excluded. Inspect both kinds for non-loopback origins; browser
resource entries must be present before claiming browser network coverage.
Check the complete log with `node e2e/bridge/check-network.mjs <log> …`; it
requires both HTTP and browser entries and rejects non-loopback origins.
This evidence covers app requests, not the explorer's separately authorized
model-provider calls. CSP does not restrict top-level navigation: stay on the
fixture origin, as the persona instructs, and do not connect external accounts.

`npm run test:flows` also runs the HTTP bridge regression tests. The Connect
flow checks selectable URL text, clipboard payload and feedback, feedback
reset, numbered setup lists and absence of API requests. e2e exposes no
clipboard-permission grant, so it uses a local clipboard sink; the Playwright
Connect spec retains the real browser clipboard check.
