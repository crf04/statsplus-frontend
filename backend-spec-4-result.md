## Spec

**Pass — no remaining material findings.** Reviewed `e1db9337` → `edc8aae412d189fe0a6cf0163f8e402c48011ef9` plus the supplied uncommitted test delta in `/tmp/statsplus-57-spec-loop/backend-spec-4`, against the unedited parent #57 and child #254 specifications. Read the previous review and mutation evidence for unchanged tests.

The prior P2 is resolved at `tests/test_residential_collector.py:3327–3378`. The waiting cycle now queues a real NBA Last-15 job, runs the production runtime, and asserts successful settlement with no composer invocation, no publication pointer, no facts, and durable waiting observations including Synergy precedence. This directly covers: “While withheld, no L15 descriptors are issued and no L15 composition is attempted or failed.” Removing the runtime waiting skip now fails; pytest locals independently confirm the real observation composer was attempted for `grouped_shot_types_opponent_l15`.

The ready half still ingests 120 accepted normalized observations and asserts active current-cutoff publications for both shot streams, 30 rows of exactly 15 IDs, and available queried shot surfaces. Runtime-local readiness permanently false and unconditional NBA Last-15 skipping both remain killed at the missing publication pointer, proving actual release rather than descriptor issuance alone.

No implementation changes or scope growth. Full owning completion gate and authenticated browser/integrated Targets checks remain the coordinator’s responsibility; this reviewer reran the changed test and its targeted mutants only. The prior report’s unchanged-test mutation evidence remains applicable.

## Mutation evidence

Command from the pinned review root: `.venv/bin/python -m pytest -q tests/test_residential_collector.py::test_l15_nba_release_transition_publishes_after_the_last_team_reaches_15` (Python 3.11.9).

| Mutation in `app/services/ledger_runtime.py` | Result | Behavioral failure |
| --- | --- | --- |
| Disable NBA waiting skip at line 908 | Killed, exit 1 | Line 3354: waiting runtime returns 0 rather than 1; `--showlocals` confirms `composed = ['grouped_shot_types_opponent_l15']`. |
| Replace runtime-local `l15_ready = governance.l15_ready` with `False` | Killed, exit 1 | Line 3457: ready-cycle active publication pointer is absent. |
| Remove readiness condition so every NBA Last-15 job skips composition | Killed, exit 1 | Line 3457: ready-cycle active publication pointer is absent. |

Baseline and every restoration passed. Final restored run: **1 passed**. Exact `git diff e1db9337` matches `backend-spec-4-initial.diff` byte-for-byte; only the original modified `tests/test_residential_collector.py` remains. All temporary mutations restored. Reused the supplied virtualenv without dependency writes.

Evidence in `/tmp/statsplus-57-spec-loop/`: `backend-spec-4-mutations.json`, `backend-spec-4-nba_waiting_skip_removed.log`, `backend-spec-4-waiting-attempt-locals.log`, `backend-spec-4-nba_runtime_readiness_false.log`, `backend-spec-4-nba_release_skip.log`, and `backend-spec-4-final-restored.log`. Prior unchanged-test evidence: `backend-spec-3-result.md` and `backend-spec-3-mutations.json`.
