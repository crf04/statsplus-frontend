# Production sample-target verification

Frontend commit 10ed0538fd18f8b61128bc9bef05bfe7f0134151; production Railway backend, actual Firebase authentication using existing dedicated QA identity. No E2E adapter or API fixtures.

A temporary copy of the project verification helper permits precisely POST /api/user/targets/preview, documented non-persistent and reviewed in backend route/service source; all create/PATCH/DELETE operations remain blocked. Original project helper and skill unchanged. Guard tests must pass before launch.

Check successful empty account GET, both exact sample cards, real backtest results from preview, no personal target count inflation, desktop and phone layouts/screenshots. At each viewport open a sample in the composer, verify inherited qualifiers, change a threshold using keyboard and verify preview refresh, cancel, reopen original preset. Reload collection and confirm empty GET/no saved targets. Collect sanitized target counts across reads. Do not Save in production; saving is covered by prior real-auth isolated QA and E2E.

Publish revised evidence and update PR #130 when successful. Keep real mutations blocked, clean up owned services, preserve existing user sessions. Include exact source hashes, journey and guard/helper copies for audit.
