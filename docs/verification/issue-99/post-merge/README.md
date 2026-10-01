# Post-merge production verification

Verified 2026-10-01 UTC using the T3 collaborative browser, a dedicated tab and
real Firebase authentication. No production application data was mutated.

- Backend: `100250454f6a779ee9d38d3c9b32c4f4e79444c8`, Railway deployment
  `ccb272ae-b17f-4898-9c6e-b8d8227c3e44`, status SUCCESS.
- Frontend: `2669389bc8ba703ec155bfcd8062a009b604fce3`, Vercel production
  deployment `dpl_Ftcnj65X4JRLUxN9Ss4nEwBL5yZT`, status Ready; aliases include
  `www.courtai.app` and `courtai.app`.
- Glossary: `7943dc8b5070ef33b473d2c2ee498ee94601b4e2`.

## Plan and observed results

| Trigger                                                       | Expected outcome                                                          | Result                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Open LeBron James, season 2025–26, Last 5 on desktop 1440×900 | New panel and 5 of 60 season strip; actual game-log transport succeeds    | Passed: filtered and season reads 200, saved list 200, no horizontal overflow |
| App loads next-opponent read through production `/api`        | Authenticated route succeeds and null game hides opponent block           | Passed: 200 with `next_game: null`, empty ranks; block hidden                 |
| Read route without auth                                       | Protected endpoint rejects request                                        | Passed: 401                                                                   |
| At phone 390×844, click + Last N → 10 → Done → Apply 1 change | URL carries `game_filter=10`, request succeeds, strip changes to 10 of 60 | Passed: request 200, literal displayed count 10 of 60, no horizontal overflow |
| Capture affected panel after each state                       | Desktop and phone show complete panel                                     | Passed: [desktop](production-desktop.png), [phone](production-phone.png)      |

The browser opened
`https://www.courtai.app/?player_name=LeBron+James&season_filter=2025-26&game_filter=5`
and the phone Apply action navigated to the same link with `game_filter=10`.
Native browser DOM inspection confirmed the strip text, hidden opponent block,
document widths and same-origin resource response statuses. Authentication
details were never exported. The temporary local authentication bridge was
stopped; the useful dedicated browser tab was preserved.

## Limits

A read-only production database transaction found 5,205 athlete rows and 1,230
events, all for 2025–26; zero future scheduled events; no 2026–27 athlete rows.
Scheduled-opponent display and live rank-tier interaction remain untested in
production until the current-season catalogs are published. Fixtures and
seeded backend tests cover those behaviors; no fake production game was added.

Current-season Player Profile and Opposing Team Profile reads also returned
404 because current-season publications are unavailable. Historical game logs
and the affected filter panel work. This is a production data prerequisite,
separate from deployment of issue #99.

## CI and reviews

Backend required checks and Postgres integration passed. Its optional dependency
audit still reports existing locked-package advisories. The frontend passed
825 Jest tests and all browser checks: 134 first-attempt passes, two passes on
retry, two production-only skips; all seven parity images passed first attempt.

The test-only October season fix and pinned CI rendering environment received
fresh Opus 5.5 reviews, included beside this record. The environment review's
suggestion to guard future Playwright lock updates is deferred: this revision
uses `npm ci` with all Playwright packages locked to 1.62.1, matching the pinned
image. A future lock update is a separate reviewed change and cannot silently
pass the unchanged parity gate if rendering differs. This is not a defect in
the deployed revision. Linux baselines were generated exclusively from the
frozen reference deployment; the private reference capture log records seven
successful captures before the separate build comparison.
