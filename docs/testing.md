# Testing CourtAI

CourtAI uses three complementary test layers. Each layer exercises a stable public seam and has a
different job.

| Layer          | Public seam                              | Runs                                      | Purpose                                                                                       |
| -------------- | ---------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Jest           | Pure modules and rendered React behavior | Local and every PR                        | Fast feedback on filter, response-decoding, formatting, and UI behavior                       |
| Playwright E2E | Browser UI and HTTP requests             | Local and every PR                        | Deterministic critical journeys using an in-browser API contract                              |
| Deployed smoke | Public deployment URL                    | Successful deployments or manual dispatch | Confirms that the built site loads and Matchups API routing reaches the authenticated backend |

Real Google authentication and backend data are intentionally outside the per-PR E2E gate. Popup
authentication, credentials, and changing live data make a poor deterministic gate. The deployed
smoke does verify that an unauthenticated Slate request traverses the production proxy and receives
the backend's stable `401 authentication_required` response. Authenticated flows can be exercised
during exploratory QA or added later as a secret-backed scheduled suite.

The production smoke intentionally fails when the backend is unavailable because a frontend release
is not usable when its same-origin API dependency cannot enforce authentication.

## Commands

Install the browser once after `npm install`:

```bash
npx playwright install chromium
```

Run the full hermetic E2E suite:

```bash
npm run test:e2e
```

Useful focused modes:

```bash
npm run test:e2e:critical
npm run test:e2e:smoke
npm run test:e2e:ui
npm run test:e2e:debug
```

Run the public smoke test against a deployment without starting a local server:

```bash
# Public production smoke does not need a credential.
E2E_BASE_URL=https://statsplus-frontend.vercel.app \
  npm run test:e2e:smoke
```

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
5. Implement the feature, make the test pass, and run `npm run test:e2e` once before opening a PR.

Browser tests should observe UI behavior and HTTP contracts. Do not select CSS classes, wait for
arbitrary timeouts, call React internals, or mock implementation modules. Prefer `getByRole`,
`getByLabel`, and `expect` assertions, which wait for the user-visible state automatically.

Tag the smallest deployment-level check with `@smoke`. Tag revenue- or workflow-critical browser
journeys with `@critical`. Untagged E2E tests still run in the complete suite.

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
single integrated journey rather than splitting it across implementation-shaped tests.

Saved Filter Sets and Targets are account state rather than reference data, so the contract
remembers what a page saved instead of replaying a fixed list. The Targets routes derive each
title from the Qualifiers on every write, as the backend does, so a journey that edits a Target can
assert the title followed it. That derivation is the fixture's own and deliberately shares no code
with the page's title preview: the fixture stands in for the backend at the HTTP seam, so a preview
that drifted from it has to be able to fail a journey.

## CI and failure evidence

The `CI` workflow runs Jest/build validation first and then the hermetic Chromium suite. Critical
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

For branch protection, require both `validate` and `E2E` before merging.

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
