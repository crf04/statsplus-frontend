# Testing CourtAI

CourtAI uses four complementary test layers. Each layer exercises a stable public seam and has a
different job.

| Layer          | Public seam                                              | Runs                                      | Purpose                                                                                       |
| -------------- | -------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Jest           | Pure modules and rendered React behavior                 | Local and every PR                        | Fast feedback on filter, response-decoding, formatting, and UI behavior                       |
| Playwright E2E | Browser UI and HTTP requests                             | Local and every PR                        | Deterministic critical journeys using an in-browser API contract                              |
| e2e flows      | Browser UI and HTTP requests at desktop and phone widths | Local and every PR                        | Complete route journeys; optional ChatGPT agent goals with replay                             |
| Deployed smoke | Public deployment URL                                    | Successful deployments or manual dispatch | Confirms that the built site loads and Matchups API routing reaches the authenticated backend |

Real Google authentication and backend data are intentionally outside the per-PR E2E gate. Popup
authentication, credentials, and changing live data make a poor deterministic gate. The deployed
smoke does verify that an unauthenticated Matchup request traverses the production proxy and receives
the backend's stable `401 authentication_required` response. (The Slate, its Edges, the ladder and
game logs are anonymous reads, so they no longer prove that the backend enforces authentication.) Authenticated flows can be exercised
during exploratory QA or added later as a secret-backed scheduled suite.

The production smoke intentionally fails when the backend is unavailable because a frontend release
is not usable when its same-origin API dependency cannot enforce authentication.

See [the e2e flow map](e2e-flows.md) for setup, subscription login, replay, route coverage, and why the existing Playwright suite remains.

## Commands

Install the browser once after `npm ci`:

```bash
npx playwright install chromium
```

The e2e flows also need `npx e2e-web install chromium` and Node 22.22.3+ (or 24.8+); see
[e2e-flows.md](e2e-flows.md#run).

Run the full hermetic E2E suite:

```bash
npm run test:e2e
npm run test:flows
```

Useful focused modes:

```bash
npm run test:e2e:critical
npm run test:e2e:smoke
npm run test:e2e:ui
npm run test:e2e:debug
```

The local server listens on port 4173. Give each concurrent checkout its own port with
`E2E_PORT=<port>`; a port already in use fails the run instead of testing another checkout's build.
Set `E2E_REUSE_SERVER=true` only to reuse a server this checkout started.

Run the public smoke test against a deployment without starting a local server:

```bash
# Public production smoke does not need a credential.
E2E_BASE_URL=https://statsplus-frontend.vercel.app \
  npm run test:e2e:smoke
```

The same command is the Release Check (crf04/statsplus#249). It also reads `E2E_API_BASE_URL`
(default `https://statsplus-backend-production.up.railway.app`) and `E2E_MCP_BASE_URL` (default
`https://mcp.courtai.app`), and runs logged out and read-only against any frontend, API and MCP:
the public landing page, the public home Slate rendering the games and edges the API serves,
Matchup deep links from that Slate resolving to the Matchup route with the API answering for the
game, MCP OAuth authorization-server metadata with a matching issuer, and `/mcp` refusing an
unauthenticated request with a protected-resource challenge. A Matchup itself is a signed-in
read, so logged out the check proves its route and its API answer, not the signed-in document.

```bash
E2E_BASE_URL=https://staging.courtai.app \
  E2E_API_BASE_URL=<staging backend> E2E_MCP_BASE_URL=https://mcp-staging.courtai.app \
  npm run test:e2e:smoke
```

The `Deployed smoke test` workflow dispatches it with mode `production` or `staging`.
`scripts/validate-deployment-url.mjs` accepts only the production trio and the `staging.courtai.app`
trio (a staging backend named `statsplus-backend-staging*.up.railway.app` and `mcp-staging.courtai.app`);
staging has no API or MCP defaults.

Protected preview smoke is a manual workflow dispatch. It accepts only an HTTPS
`statsplus-frontend-<deployment-id>-chris-fus-projects.vercel.app` URL, checks that URL before
installing dependencies, and then reads `VERCEL_AUTOMATION_BYPASS_SECRET` from the encrypted GitHub
repository secret. Do not put the value in a command, source file, or log. The secret is scoped to
the protected smoke step; the step checks that it exists before `npm ci` or browser installation.

The protected fixture sends one out-of-browser request to the exact deployment URL with the two Vercel
bypass headers and redirects disabled. It requires Vercel's `307` response, extracts only the
`_vercel_jwt` `Set-Cookie`, and adds that value to the browser context as a secure, HttpOnly,
host-scoped cookie. Browser page, redirect, and subresource requests never receive the raw bypass
secret. Local and public production runs do not bootstrap a cookie.

## Adding a feature test

Treat one user-visible journey as one vertical slice:

1. Name the user outcome, such as “a rejected query stays retryable.”
2. Decide whether Jest or the browser is the narrowest stable seam that proves it.
3. Add only the API responses that journey needs to `e2e/fixtures/courtai.js`.
4. Write the failing test through accessible roles, labels, and visible text.
5. Implement the feature, make the test pass, and run `npm run check:changed`; CI runs the full suite.

Browser tests should observe UI behavior and HTTP contracts. Do not select CSS classes, wait for
arbitrary timeouts, call React internals, or mock implementation modules. Prefer `getByRole`,
`getByLabel`, and `expect` assertions, which wait for the user-visible state automatically.

Tag the smallest deployment-level check with `@smoke`. Tag revenue- or workflow-critical browser
journeys with `@critical`. Untagged E2E tests still run in the complete suite.

## Bootstrap styles

The app ships only the Bootstrap styles it renders. `src/bootstrap-subset.scss` compiles the needed
Bootstrap partials and utility groups from Bootstrap's Sass; `src/index.js` imports it where the
full `bootstrap.min.css` used to be. When you render a Bootstrap class or react-bootstrap component
the subset does not emit yet, add its partial or utility group to that file.
`src/bootstrapSubset.test.js` fails until you do. It collects the classes src can render (string
literals outside inline `style` objects, template-literal prefixes, and the classes each
react-bootstrap component adds for its props). It then requires every rule in
`bootstrap/dist/css/bootstrap.css` that can match those classes to appear in the compiled subset,
declaration for declaration. Using a new react-bootstrap component also means adding it to the
test's `COMPONENT_CLASSES` map. `sass` is pinned to 1.78.0 because later versions compute
Bootstrap's tinted and shaded colors one channel level differently from the published stylesheet.

## Deterministic authentication and data

The Playwright web server starts with `REACT_APP_E2E_MODE=true`. In non-production builds only, this
activates a local authentication adapter selected by the browser's
`courtai:e2e-authenticated` storage key. Production builds ignore this mode even if the variable is
accidentally set.

`installApiContract` intercepts `/api/*` at the browser HTTP seam. Keep its defaults representative
but small. A test can override one route to cover failures without relying on Firebase, the private
backend, or live NBA data.

The Matchup contract serves two games. `0022500584` is the current/live slate matchup. `0022501082`
is the completed-season LAC @ MIL Historical Matchup: every Season defense Surface published, Last 15
unavailable for want of a point-in-time snapshot, no archived DFS markets, and canonical game-log
participants for both teams. One authenticated journey covers each; keep the historical outcome in a
single integrated journey rather than splitting it across implementation-shaped tests. On the live
game LeBron James carries posted `lines` (PrizePicks and Underdog disagree on his points, and only
PrizePicks numbers his rebounds; Polymarket and Dabble post points too, `line_prices` carry Underdog, Polymarket and Dabble prices plus an unknown Fliff price the decoder skips, and `book_lines` carry five sportsbook quotes), Austin Reaves has `lines: {}` so the rail falls back to his Matchup
Score, Jayson Tatum omits the field as a pre-lines backend would, and every game-log participant
carries `lines: {}`.

Game logs are an anonymous read (crf04/statsplus#381). Like the backend, the contract answers a
request without the bearer, or from a waitlisted account, with every posted line and its source but
no price: `posted_line` has no `line_prices`, and each `book_lines` entry keeps only its book and
line. Signed in, the response carries the prices. Such a request naming a `season_filter` after the
Published Season (2025-26) is refused with `503 season_unavailable`, as the backend holds an
Unpublished Season until its cutover. The contract does not count anonymous reads, so a journey
covers the per-IP limit by overriding the route with `RATE_LIMITED`.

Both Matchups carry `as_of.season` and no Serving Season fields, as today's backend sends them.
`servingSeasonMatchupPayload` is the live game after a Season Cutover to 2026-27
(crf04/statsplus#304): play types still serve 2025-26 under a `trailing` Synergy entry, and each
open Last 15 window carries `window_games: 6`. `slatePayload` takes a `trailing` option for the
Slate note. A flow overrides the route with them; the defaults stay single-season.

Target resolution is composed from those same two Matchups rather than canned, so the shares and
Defense Sheet readings a Target shows are the ones the Matchup page shows for the same game.
`0022500584` resolves on `2026-01-15` against the stored Player Pool and `0022501082` on
`2026-03-29` against game-log participants; a Target naming any other team is idle. Values the
backend derives are recomputed rather than copied: the derived title, and whether a fit's Diet is
thin, from the `games_played` and `volume` on each stored fact against the Matchup Score's floors.
A Target's backtest is composed the same way but league-wide and season-to-date. It reads every
player either Matchup publishes, excludes the thin Diets rather than flagging them, derives its
outcome columns from each Qualifier's slice, and averages a player's season over the games the
game-log route serves for that player — so a backtest row and the Log Workspace that row hands off
to show the same game. Its summary is the contract's own arithmetic over those games. The Targets
list first asks `GET /api/user/targets/backtests`, which serves only cached backtests: the fixture
answers `ok` from that same composition for a Target its single route has already read (with an
unchanged opponent, Qualifiers and Conditions) and `uncached` otherwise, in list order. The list
reads each uncached Target through the per-Target route, and every Target that way when the batch
route answers `404` or `405`. The preview a
Draft Target's Lab reads is the same composition for a Target that is stored nowhere, with a `today`
block resolved against the current Slate date; it refuses a missing bearer, an unknown base or slice,
and more than ten Qualifiers with the backend's envelopes. Every backtest route takes an optional `season`
(preview body, `?season=` on the GETs): `2025-26` or `2026-27`, and anything else, `2024-25` and an
explicit `null` included, is `400 invalid_input`. Without one, a body reads the `2025-26` default with
`season_reason: "default"`; a named season is `requested`. The published season is `2025-26` and nothing
is published for `2026-27`, so naming it is `503 season_unavailable` with `details`
`{season: "2026-27", published_season: "2025-26", stream: "player_game_logs"}` rather than an empty
Backtest; the batch route refuses the whole request the same way. Every backtest body and the batch
envelope carry `season_reason` and `published_season: "2025-26"`. A Defender Condition is validated
against the backtest's season. `GET /api/teams/<tricode>/season-minutes` takes the same optional `season`
and answers with `season`, `season_reason` and `published_season`, or the same refusals. The slate route reports pool freshness that matches the evidence resolution
reports for the same date — a fresh pool on the scheduled date, none on the completed one — so a
journey never sees one route call a pool unavailable while the other lists players from it.

Targets without saved stat preferences use these default `stat_columns`, in Qualifier order with
duplicates removed: any play type uses `PTS`, `FGA`, `PTS/36`, `FGA/36`; a two-point shot zone uses
`PTS`, `PTS/36`, `FG2A`, `FG2A/36`; a three-point shot zone uses `PTS`, `PTS/36`, `3PA`, `3PA/36`;
any shot type uses `PTS`, `PTS/36`, `FGA`, `FGA/36`; and any assist location uses `AST`, `AST/36`.
The `FG2A` value is two-point attempts (`FGA - 3PA`), and `/36` values use the player's total
production divided by total minutes. Saved explicit preferences continue to control the displayed
columns and grading column.

Jest runs in a fixed timezone east of UTC (`TZ=Asia/Tokyo` in the `test` scripts). A date the
product reads in UTC is only observably read in UTC when the machine reading it is somewhere else,
so anything asserting a calendar day should use an instant near midnight UTC.

The Report Builder's Cards come from the MCP server, not the backend (crf04/statsplus#382), so
`installApiContract` also answers its two browser routes, `POST /web/cards/preview` and
`POST /web/reports`, on whatever host the build names (`REACT_APP_MCP_BASE_URL`; a local build
defaults to `http://127.0.0.1:8001`). Both refuse a missing bearer with `401 unauthorized` and answer
with CORS headers, as the server does. A preview draws a placeholder Card for any of the five card
tools and returns its args as the canonical call (a Filter Set comes back with only the player and
market converted). A publish checks the body against the contract (unique call ids, at most 48 calls,
rows of 2–3, every card naming a call) and answers with `BLOCK_REPORT_ID`. The authenticated
fixtures set their storage key only in the top frame, because a sandboxed Card frame has no storage.

Saved Filter Sets and Targets are account state rather than reference data, so the contract
remembers what a page saved instead of replaying a fixed list. The Targets routes derive each
title from the Qualifiers on every write, as the backend does, so a journey that edits a Target can
assert the title followed it. That derivation is the fixture's own and deliberately shares no code
with the page's title preview: the fixture stands in for the backend at the HTTP seam, so a preview
that drifted from it has to be able to fail a journey.

## CI and failure evidence

The `CI` workflow runs Jest/build validation (`validate`), the hermetic Chromium suite (`E2E`) and the e2e flows (`e2e flows`) as parallel jobs. Critical
journeys run at a desktop viewport, and the public smoke test also runs at a Pixel 7 viewport. Failed
hermetic runs without a bypass secret retain an HTML report, trace, screenshot, and video for 14 days.
Credential-bearing deployed smoke runs retain the HTML report and screenshots, but force trace and video off so the raw
bypass credential or cookie cannot enter CI artifacts. Open a retained hermetic trace with:

```bash
npx playwright show-trace path/to/trace.zip
```

The `Deployed smoke test` workflow is triggered after a successful Production deployment status, then
validates the current promoted public `https://statsplus-frontend.vercel.app` alias rather than the
deployment's potentially protected immutable URL, and checks out the repository's trusted default
branch harness. If alias promotion lags the deployment status, this check can transiently exercise
the prior build. That public production path uses no bypass secret. Explicit `workflow_dispatch`
runs for production must provide exactly that public alias; Protected Preview runs should provide the
protected deployment URL. Both manual paths check out `github.workflow_sha`, the immutable revision
of the reviewed workflow selected for that dispatch; they never check out the moving deployed commit
or an older default-branch harness. Protected Preview smoke validates its URL and fails closed when
the encrypted repository secret is missing. Playwright trace and video are disabled whenever the
secret is present; screenshots remain available for failure evidence.

Branch protection on `master` requires `validate`, `E2E`, `e2e flows`, `qa-evidence` and `parent-links` before merging. `E2E` and `e2e flows` are
aggregate jobs over matrix legs (Playwright shards `1/7` to `7/7`; two e2e flows slices per
target, `1/2` and `2/2`): each passes only when every leg passed, so the required names are
unchanged. `playwright-evidence` is the merged HTML report; `e2e-flow-evidence-<target>-<slice>` and
`playwright-test-results-<shard>` hold per-leg evidence.

The `QA evidence` workflow holds a ready pull request that changes runtime files (anything outside
tests, docs, CI and tooling) to its `Live checks:` line: `user-visible` needs a passed QA
`evidence.md` table from verify-statsplus, `boundary` also a passed production table (or a staging
one when the change needs a merged backend change that is not released yet, named on an
`Unreleased backend: crf04/statsplus-backend#N` line), and
`gates only` a cited test file (`*.test.js(x)`, `__tests__/` or `e2e/`). A table counts only when no
runtime file differs between its Frontend revision and the head, so commit before QA and rerun it
after a later runtime commit, including one merged in from master.
Drafts are skipped. The rules live in `.github/scripts/check_qa_evidence.py`.

## Codex exploratory QA

After automated checks pass, ask Codex to open the local app or preview in its collaborative browser
and test the acceptance criteria. A useful exploratory pass includes:

- desktop and narrow mobile viewports;
- keyboard-only navigation through the changed flow;
- loading, empty, and rejected-request states;
- browser console and failed-network inspection;
- a screenshot or short recording for any visual regression.

Exploratory findings should become a focused automated regression test when they represent stable,
repeatable behavior.

Targets use the same league-scaled Qualifier slider in the composer, capture
modal and workbench. The authenticated `/api/diet/baselines` fixture includes
nullable league shares; absent shares omit the tick. Browser tests adjust the
native range control using keyboard arrows through `setTargetThreshold`.
The workbench reads the draft automatically, preserves stale evidence during
changes, and keeps Save/Revert separate from selecting the grading column.

Conditions travel with the draft and saved Target. The fixture's opponent
season logs supply both roster minutes and the games-considered denominator;
a missing defender line counts as zero minutes. The Conditions journey keeps
ATL's game against BOS while excluding the games Capela played, then verifies
the saved card's Backtest GET and an inclusive date-window exclusion. The
current BOS fixture treats Porzingis as out, so its Slate Fits exercise both
sides of the minutes comparator. Decoder and UI tests also cover absent legacy
Conditions, malformed dates/counts, partial PATCH clearing, opponent changes,
and preservation of the workbench's grading and paging through Save.

The same Target fixture applies the optional player-game minutes threshold to
each retained appearance. Its browser journey sets the strict `> 36` boundary
to an accurate empty result, returns to `> 35`, and checks create, revert,
reload, stat-preference persistence, and the compact saved summary.
`games_considered` remains the opponent-game denominator while player-games and
summaries follow the retained appearances.

The Target record derives selected stat columns from full game lines and season totals,
using `season_games` only for box-score season averages. Per-36 and efficiency baselines
use ratios of totals; zero denominators remain unavailable. UI hit rates count strictly
positive margins and treat zero as a push, while the additive legacy API summary retains
its at-or-above definition. The fixture supplies both from the same game logs. Stat
preferences use independent PATCH requests, with account-scoped serialization and a
captured-user check before bearer attachment; React tests exercise navigation flushes,
retry, criteria-save remounts, and account isolation.

TargetRecord’s headline is an aggregate absolute difference with a separate relative change
label (`vs baseline`). Raw box-score columns use the mean of matched game minus season-average
values and report `<STAT>/game`; per-36 columns compare production at each appearance’s minutes
and weight by valid minutes; efficiency columns weight FG%, 3P%, TS%, and PTS/FGA by their
respective attempts/exposure. Each aggregate excludes rows with missing values or invalid
denominators and reports its eligible player-game count when it is smaller than the displayed
sample. The hit rate remains a separate strictly-positive individual-margin measure. The sample
strip reports displayed player-games and total minutes only when every displayed line has a finite
nonnegative minute value; otherwise it says that minutes are unavailable or incomplete.

Target opponent context is read independently of preview/save. Its API and hook
suites verify every exact slice, combined shot-attempt fields, per-form request
sharing, opponent-switch cancellation, and retry isolation. The browser journey
`target context follows the selected defense and survives context-read failure`
uses the normal target routes to verify context, real draft persistence, and the
full-width summary above the filters-left/games-right grouping. Context failure must never disable an
otherwise-valid Save. Test selectors distinguish the Opponent combobox from the
per-filter opponent context label.

Empty authenticated Targets lists show two shared sample drafts: ORL versus P&R
ball handlers at or above 25%, and NYK versus P&R roll men at or above 15%. Each reads the existing preview endpoint;
viewing samples and adjusting their displayed stats never writes account state.
The desktop and phone sample journeys copy an example into the composer, edit
it, save it, and verify samples disappear on return and reload. React tests also
cover loading/list failure, saved accounts, canceling a copy, and preview retry.

The Log Workspace filter panel copies the frozen J design's parity kit without
changing its screenshot baselines. Run `npx playwright test filter-panel-parity
--project=chromium` for that gate. `filter-panel.spec.js` also checks next-opponent
tiers against a reduced ranked population, context-only stats, and no scheduled
game. The strip and Own stat line share the unfiltered season read; the new
`/api/players/next-opponent` read is independent and its absence hides that block.
