# Controlled waiting-state QA: passed

Backend edc8aae412d189fe0a6cf0163f8e402c48011ef9, frontend 65ec297b3bb899292d16d36f90ad7ce95a545e6a. Real Firebase authentication and actual frontend HTTP transport to the changed local backend on a disposable PostgreSQL copy. Frozen snapshot SHA-256 3fe69266e135d9ed9e6f671d01e7034c7d529a6ee3a9fa6395851b003ee222f5.

Command: python3 /tmp/statsplus-57-spec-loop/run-waiting-qa.py /tmp/statsplus-57-spec-loop/backend-qa-final /tmp/statsplus-57-spec-loop/qa-waiting-final

The retained seed-browser-waiting.py sets a controlled stored waiting state only in the disposable database, retains older active publications to detect leaks, gives stats_tables a completion timestamp, and reschedules NOP/BOS to reach current-mode controls. No production or frozen-seed changes. This is a persistence-to-UI scenario; automatic readiness/collection/publication transition is proved by the separate catalog-bound backend tests.

Passed: matchup GET 200; all four supported Last-15 bases show the complete waiting sentence; no raw waiting identifier or old L15 values; play types retain provider_window_unsupported. Season OPP REB remains visible before and after switching windows. Desktop and phone window controls, phone overflow, reload and waiting message persistence pass. Targets list and resolve GETs both return 200; No Targets yet and No Targets active today render without alerts. Desktop/phone screenshots inspected.

Limits: Targets browser coverage uses an empty dedicated QA account; populated withheld reason propagation has separate backend/decoder review smoke evidence. The current Targets page no longer mounts its L15 n/a context component; this predates the PR and remains out of scope. NBA HTTP/outbox transport and real season rollover are not driven by this browser scenario. Existing white background beyond the initial phone viewport is unchanged styling.

Cleanup: cleanedUp=true and runtime absent; executed JSONL/hash, setup script/hash, source fingerprints, screenshots, ARIA, response summaries and video retained. Final backend-head test-only changes, if any, are documented in the evidence README; application code is identical.
