**Standards: PASS.** I found nothing material left to fix in the updated tests or the evidence.

**What I checked**

- **Source is frozen:** frontend `ecb66a2..e81985d` touches only test files, plus the evidence directory from `8bfcf6f`. Backend `ee311a6d` hasn't changed since the last PASS.
- **Focused tests:** `jest src/FilterOptions.test.js src/nextOpponentApi.test.js` passed, 22 of 22.
- **New Jest tests in `src/FilterOptions.test.js`:**
  - Strip cells change from over to under when the chart line moves.
  - Picking a teammate suggestion adds the row and the `players_on[]` change.
  - A link with only a playtype minimum keeps the default maximum of 200.

  All three drive the panel through roles and visible names and compare against literal URL changes. That meets the "test behavior, not implementation" rule and `docs/testing.md` ("observe UI behavior and HTTP contracts").

- **New decoder cases in `nextOpponentApi.test.js`:** `most_rank` 0 and 1.5, and a numeric `team_filter`. Each has to throw, so they check behavior.
- **`e2e/specs/core-flows.spec.js` request selection:** it now picks the filtered request with `findLast(game_filter === '10')` rather than `at(-1)`. That fixes the race between the season read and the filtered read without weakening what the test asserts.
- **New e2e cases in `filter-panel.spec.js`:** most-allowed tier, sharing the historical season, the signed-out request guard, the saved set marked open, and the season-switch race. They assert the URL's `rank_filter[]`, the requested `season_filter` values, slider `aria-valuenow`, and accessible names. None of them uses arbitrary timeouts, CSS class selectors or React internals.

**Earlier findings:** everything from `standards-initial`, `standards-final` and `standards-delta` is still resolved.

**Non-blocking notes, no change needed**

- The "marked open" e2e test reads the `::after` content on the saved set's `<b>` to check the " · open" marker. That inspects CSS rather than accessible text. It doesn't select a class and it asserts what the user sees, so it's acceptable. An accessible marker would make the check sturdier.
- `qa-inline-saved.jsonl` selects `.fpx-saved` by class. It's a verify-statsplus QA script, not a repository test, so the `docs/testing.md` rule doesn't cover it.
- The pass counts in `docs/verification/issue-99/README.md` (819 Jest, 132 E2E) belong to `ecb66a2`, which the README pins. The later test-only gate (825 Jest, 136 E2E) should be recorded in the PR.
- Unchanged from earlier reviews: unused prototype CSS selectors, and the `onOpenSelfFilters` prop name.

I didn't change any files, publish anything, or run browser tests or full gates.
