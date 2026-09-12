## Spec

Reviewed `e1db9337` → `2d26ef13c3b79eaf0c17afaf8b143ed99a7aba6d` plus supplied uncommitted changes in `/tmp/statsplus-57-spec-loop/backend-spec-3`. Baseline: **12 passed**.

**Both round-2 material findings are corrected.** Real `DatabaseFirstPublicationReader` first-generation tests persist the waiting observations for both a short and absent canonical team; restoring the old first-generation skip kills both tests. The new residential test ingests 120 real accepted normalized observations, runs `LedgerRuntime.compose_queued` with a real `PublicationService`, and asserts active pointers/current-cutoff publications with 30 rows of exactly 15 game IDs plus queried available shot surfaces. Both previously surviving release mutants (runtime-local readiness always false; unconditional NBA L15 skip) now fail at the missing publication pointer.

**One remaining verification gap (P2): NBA waiting composition remains untested.** Spec: “While withheld, no L15 descriptors are issued and no L15 composition is attempted or failed.” In `tests/test_residential_collector.py:3320–3338`, the waiting cycle contains zero `CompositionJob` rows, so `compose_queued() == 0` cannot exercise the new waiting branch at `app/services/ledger_runtime.py:908–914`. Removing that branch still passes all 12 changed behavior tests, including the new residential transition. Queue a withheld NBA L15 job and assert the real runtime settles it without invoking `compose_from_observations`, without publishing facts, and with durable waiting observations; then confirm deleting the skip fails. Keep the existing ordinary-cycle no-descriptor assertions. This is a regression-coverage finding, not evidence of a current runtime defect.

The ready publication path, first-generation writer, canonical roster guard, recorded-read precedence, and explicit Season/unsupported controls are supported by focused checks. Full owning gate and authenticated Targets/browser verification remain coordinator checks. No implementation fixes made.

## Mutation evidence

Executed `.venv/bin/python -m pytest -q <nodeid>` from the pinned isolated checkout, Python 3.11.9. All 12 added/meaningfully changed behavior tests were killed individually by their intended defects. Final restored run: **12 passed in 5.07s**. The two correction tests only adapt governance doubles and retain their behavioral assertions; both also pass (**2 passed in 0.57s**).

| Mutation | Test | Outcome |
| --- | --- | --- |

| `canonical_guard` | `test_l15_ready_requires_the_full_canonical_team_roster` | Killed (exit 1) |
| `descriptor_guard` | `test_manifest_l15_boundaries_are_withheld_until_the_league_is_ready` | Killed (exit 1) |
| `descriptor_guard` | `test_compose_queued_releases_l15_when_the_last_team_reaches_15` | Killed (exit 1) |
| `waiting_success` | `test_compose_queued_with_incomplete_governed_roster_persists_missing` | Killed (exit 1) |
| `waiting_success` | `test_compose_queued_with_incomplete_governed_l15_persists_missing` | Killed (exit 1) |
| `waiting_success` | `test_compose_queued_releases_l15_when_the_last_team_reaches_15` | Killed (exit 1) |
| `persist_waiting` | `test_materialize_withholds_l15_publications_until_the_league_is_ready` | Killed (exit 1) |
| `absent_reason` | `test_materialize_withholds_l15_for_an_absent_canonical_team` | Killed (exit 1) |
| `durable_read` | `test_durable_waiting_l15_outranks_an_active_publication` | Killed (exit 1) |
| `quiet_completeness` | `test_withheld_l15_completes_cycle_without_alerts` | Killed (exit 1) |
| `readiness_permanently_false` | `test_compose_queued_releases_l15_when_the_last_team_reaches_15` | Killed (exit 1) |
| `composition_readiness_permanently_false` | `test_compose_queued_releases_l15_when_the_last_team_reaches_15` | SURVIVED (exit 0) |
| `nba_release_permanently_withheld` | `test_compose_queued_releases_l15_when_the_last_team_reaches_15` | SURVIVED (exit 0) |
| `first_generation_skip` | `test_first_nba_generation_records_withheld_l15_with_real_reader` | Killed (exit 1) |
| `first_generation_skip` | `test_first_nba_generation_records_withheld_l15_for_absent_team` | Killed (exit 1) |
| `nba_runtime_readiness_false` | `test_l15_nba_release_transition_publishes_after_the_last_team_reaches_15` | Killed (exit 1) |
| `nba_release_skip` | `test_l15_nba_release_transition_publishes_after_the_last_team_reaches_15` | Killed (exit 1) |
| `nba_waiting_skip_removed` | `test_l15_nba_release_transition_publishes_after_the_last_team_reaches_15` | SURVIVED (exit 0) |
| `quiet_finish_only` | `test_withheld_l15_completes_cycle_without_alerts` | Killed (exit 1) |
| `quiet_maintenance_only` | `test_withheld_l15_completes_cycle_without_alerts` | Killed (exit 1) |
| `nba_waiting_composition_attempted` | `all 12 behavior tests` | SURVIVED (exit 0) |

The old ledger-only transition still cannot kill the NBA-specific release mutants, but the new residential transition now does. Those kills occur at the missing active publication pointer, so they verify actual publication release. Both first-generation mutations fail because `shot_types` waiting observations disappear. Independent completion and maintenance mutations respectively fail with `cycle_incomplete` and unexpected cycle attention.

Targets check: temporarily changed the existing historical missing-window fixture and expected reason to `insufficient_governed_games`, ran `tests/test_target_resolution.py::test_a_completed_games_context_reads_its_own_defense_windows`, and restored the test byte-for-byte: **1 passed in 0.49s**. This exercises real Targets resolution against injected Matchups data, confirming reason propagation, unchanged available Season, and null L15 metric. It is not an authenticated browser/integrated-transport check.

Exact-15 checks at `team_matchup_publications.py:109–112` remain unchanged, including equality against governed IDs. The new test directly verifies 30 rows / 15 IDs and both available queried shot surfaces; the query also validates those rows against the Event Catalog expectations.

Restoration: final `git diff e1db9337` equals `backend-spec-3-initial.diff` byte-for-byte; only the same three pre-existing modified tracked files remain. No implementation fixes or added tracked files. The supplied `.venv` was reused, with no dependency writes. Full `./scripts/check.sh` and authenticated browser journeys were not rerun by this reviewer.

Detailed evidence: `backend-spec-3-mutations.json`, `backend-spec-3-*-mutant*.log`, `backend-spec-3-restored-green.log`, `backend-spec-3-targets-withheld.log`. Reproduction harnesses: `backend-spec-3-mutate.py`, `backend-spec-3-extra-mutations.py`.
