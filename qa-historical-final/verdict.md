# Historical QA: passed

Backend edc8aae412d189fe0a6cf0163f8e402c48011ef9 in /tmp/statsplus-57-spec-loop/backend-qa-final. Frontend 65ec297b3bb899292d16d36f90ad7ce95a545e6a in the isolated frontend feature branch. Actual app/transport and real Firebase auth against a disposable PostgreSQL snapshot, SHA-256 3fe69266e135d9ed9e6f671d01e7034c7d529a6ee3a9fa6395851b003ee222f5.

Command: node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs --backend /tmp/statsplus-57-spec-loop/backend-qa-final --frontend "$PWD/.statsplus/worktrees/frontend" --port 5192 --out /tmp/statsplus-57-spec-loop/qa-historical-final < /tmp/statsplus-57-spec-loop/historical-journey.jsonl

All recorded historical commands passed: NOP/BOS slate/detail 200 and rendered data; historical Last15 unavailable with point-in-time reason; desktop/phone stat controls, overflow check and screenshot proof; reload; empty slate; invalid-date 400 and alert; valid-date recovery. Executed JSONL/hash and response/source metadata retained. This checks existing historical compatibility, not the early-season collection transition.

Cleanup confirmed: cleanedUp=true; owned runtime absent. Final feature-head test-only additions, if any, are documented in the parent evidence README; this commit contains the final application behavior exercised here.
