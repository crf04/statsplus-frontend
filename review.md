**Verdict: the sample revision matches the spec. No blocking findings.**

**Spec conformance**
- The presets file defines exactly two samples: ORL `PRBallHandler` at_or_above 0.25 and NYK `PRRollMan` at_or_above 0.15 (`src/targets/SampleTargets.js:6-21`). Both slice keys and labels exist in the catalog and the E2E fixture. The comparator is the existing inclusive `at_or_above`, which is the correct reading of "> 25" given the contract only offers at_or_above/at_or_below.
- The React empty-list test asserts both card titles by exact accessible name and a count of 2 (`src/targets/TargetsPage.test.js:284-292`). The copy and cancel tests check the ORL card's opponent, slice, and 25 threshold.
- E2E asserts a count of 2 and the ORL copy flow with threshold 25, saving as 26 (`e2e/specs/targets.spec.js:49-64`).
- The docs paragraph names both presets and thresholds (`docs/testing.md:226-227`).
- No leftover references to the prior three samples in tests, docs, or page code. The other E2E diffs only scope Backtest summary selectors to the Lab region or dialog, needed now that sample cards also render that list. No behavioral assertions changed.

**Narrow sample React tests:** 6 passed, 48 skipped. React emits pre-existing act() warnings from the target list read; not failures.

**Mutation results**
| Mutation | Result |
|---|---|
| ORL 0.25 to 0.3 | Fails: cannot find article "ORL vs P&R ball handler ≥ 25%" |
| NYK 0.15 to 0.2 | Fails: cannot find article "NYK vs P&R roll man ≥ 15%" |

**Restoration:** `SampleTargets.js` restored, SHA-256 identical to the original. Working tree status unchanged from the start. No commits, no changes to the real checkout.

**Minor, non-blocking**
- E2E does not assert the NYK card title, only the count of 2. React covers it, so this is fine.
- The docs line at `docs/testing.md:227` runs past the file's wrap width. `npm run format:check` likely ignores Markdown here, but verify in the full gate.
