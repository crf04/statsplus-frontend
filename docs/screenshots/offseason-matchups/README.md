# Offseason Matchups verification

Frontend code: 1818700e09040c1c771220f062dafc48c0ebc8df (base d49975a).
QA backend: ab9b92c533973e43d50a04170963056672fa736b.

Both QA and read-only production journeys passed all 47 commands with real Firebase authentication. Default March 11 displays six games; next/previous dates, reload, phone Today/empty slate, explicit picker, invalid-date 400, and recovery passed. The controls and request parameters were checked together. Both owned sessions cleaned up successfully and their runtime directories were removed.

QA snapshot SHA-256: 3fe69266e135d9ed9e6f671d01e7034c7d529a6ee3a9fa6395851b003ee222f5.

Frontend gates passed: lint, format:check, 747 Jest tests, build, 108 Playwright tests (2 deployment-only tests skipped). Coordination check passed with the selected QA backend. The default resolver's older research backend has unrelated missing routes/catalogue; it is not the QA backend.

Production mode uses the local frontend and Railway; the local backend source SHA does not identify deployed Railway code. QA disables paid AI and external DFS/injury providers. Those integrations and the Google popup itself are outside this date-default check. Historical player-pool availability remains visibly unavailable as returned by the API.

Screenshots are unmodified full-page captures. The phone capture shows a white background below the original viewport; date controls, visible game rows, interaction assertions, and overflow checks pass. No styling changes are included in this PR. Videos preserve the actions and results.

Each environment contains the executed JSONL, its SHA-256, source verification metadata, screenshots, and video. Full session records remain locally in /tmp/statsplus-offseason-pr-evidence.
