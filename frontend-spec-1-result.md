# Astra high Spec review — 0 material findings

Current Matchup per-window renderer displays the waiting sentence. Both new tests exercise that branch. Browser test returns to Season and verifies OPP TOV remains visible. Temporary rendered-component probe confirmed unknown future_governance_reason retains its raw-string fallback.

Targets limitation predates this diff: current TargetsPage renders fit pills, never mounts TargetContext. Temporary probe passed the withheld reason through real decodeResolvedTargets into TargetContext and verified L15 n/a; existing Targets page rendering test passed. No scope expansion warranted.

Mutation evidence:
- Jest MatchupDetailPage.test.js:570: baseline 1 pass; restore raw {availability.unavailableReason}. renderer -> 1 failure at line 587; restore change -> 1 pass.
- Playwright matchup-detail.spec.js:512: baseline 1 pass; same renderer defect -> 1 failure at line 548; restore -> 1 pass.

Commands:
```
npm test -- src/matchups/MatchupDetailPage.test.js -t 'explains a withheld Last-15 window' --silent
E2E_BASE_URL=http://127.0.0.1:4289 npm run test:e2e -- e2e/specs/matchup-detail.spec.js --project=chromium --workers=1 --grep 'explains a withheld Last-15 window' --reporter=line
```

Review tree restored exactly to received uncommitted diff; SHA-256 57d7c58b16d74cae8afed0df7c3e51e31f4e48bd8bb5f32582bfc1835070dcdc. Owned Vite 4289 stopped. Logs in frontend-spec-1/test-results/review-{jest,e2e}-mutant.log. Reviewed files match committed 65ec297b3bb899292d16d36f90ad7ce95a545e6a.
