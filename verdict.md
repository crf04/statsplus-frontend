# Historical Matchup closeout — passed

No application code changed. This run supplies the outstanding authenticated production walkthrough for statsplus#42 and statsplus-frontend#66.

- Frontend: `2f92cba52430458822c7ac664a9598409b51cc80`, clean, fingerprint in session.json.
- Production backend: `a994f66b257a073991ac0539d7996fba0e3d9fb1`; Railway deployment `18d00b67-c4cd-4002-9694-15c8cf43205e` reported SUCCESS before launch. The helper's backendSource is only the Railway credential-source checkout, not the deployed revision.
- Real Firebase authentication; actual frontend transport to production Railway; read-only user actions.
- Browser: desktop 1440×900, phone 390×844. All 50 recorded steps passed; cleanup succeeded and the owned runtime no longer exists.

## Production observations

| Behavior | Verdict | Evidence |
| --- | --- | --- |
| Exact final game 0022501082 renders MIL Season Defense Sheet, all five surface groups, section-owned completed-season provenance | Passed | historical-desktop; GET matchup 200 |
| Historical L15 disabled with no point-in-time snapshot message; no generic Pool/Stats region or current injury card | Passed | historical-desktop ARIA and explicit assertions |
| Canonical opposing participants with actual focal lines; defense-team switching changes the rail | Passed | historical-desktop, historical-mil-participants; desktop and phone switches |
| PTS category removes unrelated OPP BLK rows and retains Cut PTS; both sorting modes work | Passed | historical-pts-score-order, historical-phone; selected at both widths |
| Select Kawhi Leonard with no archived Player Pool; focal 20 PTS / 22.6 MIN separated from one prior opponent game; stored Score Matrix renders | Passed | historical-selection-desktop, historical-selection-phone; GET selection 200 |
| Phone team/category/sort/selection controls, deep-link reload and Escape dismissal | Passed | journey.jsonl and session.json; phone proofs; no document overflow |
| Unknown/unavailable score ordering and current/live regression | Existing automated evidence | Exact historical fixture in e2e/specs/matchup-detail.spec.js; full gates and reviews in frontend PR68 and PR129; PR129 validate/E2E succeeded |

Historical score evidence follows statsplus#47's completed-season policy, which supersedes the original focal-free scoring rule in #42. All ten production LAC PTS scores were available; missing-score ordering is proven by the deterministic fixture, not this production dataset.

## Existing QA and gates

The merged implementation records full frontend lint, formatting, Jest, build, and Playwright gates. Latest frontend PR129 records 749 Jest tests and 109 Playwright passes (2 preexisting skips), plus authenticated disposable-QA historical and failure/recovery journeys. Those existing QA results are reused; this closeout did not rerun all frontend tests or launch another disposable QA database.

QA evidence: https://github.com/crf04/statsplus-frontend/blob/54b71e25dc64b5f246c3cd9d13374c7ea96f9021/qa-historical-final/verdict.md

Fresh coordination check passed: 4 tests, 13 endpoint contracts, clean selected checkouts; coordination 54a4cb6fcb78b29d8ccc65c9859d54f50ee30ca5, backend 15a9e7139c3dc7677ce0b3698231c266cdbfd4e4, frontend 2f92cba52430458822c7ac664a9598409b51cc80.

## Limits

Screenshots were inspected. Existing white background gaps and low-contrast text persist, as already recorded in PR129; phone interaction and overflow checks passed, but this does not complete the broader phone redesign in statsplus#44. No production mutations or provider collection was performed. The Google sign-in popup was not tested; the dedicated helper restored a real authenticated session.

## Command

From the coordination checkout:

```sh
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs --environment production --frontend /Users/chrisfu/.t3/worktrees/statsplus/t3code-1b6a5bef/.statsplus/worktrees/frontend --backend /Users/chrisfu/statsplus-backend --out /tmp/statsplus-closeout/42-production
```

Commands were sent interactively in journey.jsonl order; each recorded command SHA-256 was checked against that file. Session metadata and response records exclude authentication tokens.
