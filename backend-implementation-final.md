Done — test-only change, **no application-code change** (coordinator may keep browser QA pinned at `edc8aae` for runtime behavior, but the latest branch tip is below).

## Revisions
- Previous tip: `edc8aae412d189fe0a6cf0163f8e402c48011ef9`
- New tip: **`8169e780c9de1e7fb90928c393f9db4bdad08b9b`** — `Cover the withheld NBA Last-15 waiting branch in the release transition (#254)`

## Finding addressed (P2, test-only)
Extended `test_l15_nba_release_transition_publishes_after_the_last_team_reaches_15` (cycle one of the existing real-reader/runtime fixture):
- Kept the ordinary no-descriptor assertion (`_manifest_l15_date_from_by_team == {}` and zero L15 descriptors).
- Queues a real withheld NBA L15 `CompositionJob` (`grouped_shot_types_opponent_l15`) and spies on `PublicationService.compose_from_observations`.
- Asserts `compose_queued == 1`, the composer was **never invoked**, the job settles `succeeded` with no error, no `PublicationPointer` is published, the L15 read model has **no facts**, and durable waiting observations persist (`shot_types`/`shot_zones` = `missing/insufficient_governed_games`, `play_types` = `unavailable/provider_window_unsupported`).

## Mutation / restored evidence
- Removing the NBA waiting skip (`if False and job…endswith("_l15")`) makes the test fail at `assert runtime.compose_queued(season) == 1` (`0 == 1`), because it now attempts `compose_from_observations` on a withheld job. Killed.
- Restored: `1 passed`.
- No residue (`rg "MUTATION|if False"` clean); `git diff` shows only `tests/test_residential_collector.py` (47 insertions, 4 deletions).

## Gate
`./scripts/check.sh`: **4857 passed**, coverage **84.96%** (floor 62%), ruff clean, migrations idempotent, demo DB valid.

## Limits
None new. No push/PR; browser/Targets verification remains the coordinator’s.