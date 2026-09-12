# Production compatibility: passed for historical journey

Frontend 65ec297b3bb899292d16d36f90ad7ce95a545e6a, clean feat/57-last15-wait checkout. Deployed backend revision unknown; local backend source recorded in session.json is credential-source context only.

Command: node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs --environment production --frontend "$PWD/.statsplus/worktrees/frontend" --backend /Users/chrisfu/statsplus-backend --port 5191 --out /tmp/statsplus-57-spec-loop/production-1 < /tmp/statsplus-57-spec-loop/historical-journey.jsonl

Real Firebase authentication and normal frontend transport to Railway passed. Historical NOP @ BOS on 2026-04-10: slate/detail 200, historical Last 15 disabled with no-point-in-time explanation, Season data displayed. Desktop and phone stat controls changed rows; phone overflow assertion passed. Reload returned 200. Empty slate returned 200 and its message. Invalid date returned 400 and an alert; changing to valid date recovered the slate. All planned historical commands passed. Desktop/phone PNGs visually inspected.

Limits: this is completed-season data; it does not expose the new early-season waiting state or test undeployed backend changes. Full-page captures include existing white background areas outside dark panels below the viewport; no CSS changed in this PR. Auth sign-in popup itself is not exercised. Targets resolution for the intentionally invalid date also returned 400 as expected.

Cleanup: session cleanedUp=true, owned runtime path absent; screenshots, ARIA, response metadata, video, executed journey and SHA-256 retained.
