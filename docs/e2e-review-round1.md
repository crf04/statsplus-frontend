# Review fix round 1

PR #155 is an Internal-tier test repair, dependent on merging #157 first.
No application defect was found and no application source was changed.

## Findings and proof

- The independently reviewed #155 baseline `1366da1` had 137 Playwright passes,
  one clearing-control failure, and two skips without retries. This round's
  first full run at `8c7f22a` also had 137/1/2, failing the season-preservation
  race instead. The final code run at `c48456b` had 137/1/2 and failed
  clearing-control. #157 repairs all three races; CI retry success is not a clean
  first-attempt result. Historical 55/110 and 57/114 journey/width counts are
  now labelled by revision; the strengthened suite has 60/120.
- #157 at `84b75f43e202ef51e54fed3c5e09827448657a1a` asserts exactly one new
  indexed request, checks relevant parameters rather than the entire query,
  and requires the two clearing journeys to expand displayed games from one
  to two. Both stray-read mutants fail. Unrelated `page_size=100` and a 1500ms
  initial-season delay each preserve all three tests. Originals failed under
  late Apply; only the intermediate containment assertions passed falsely.
- #155 now checks Previous/Today/date values, Close/focus/pressed state/history,
  inclusive Target Through dates and fit isolation across two games,
  Cancel/reopen resets, table-only filter badges, analytics and reference rows,
  signed-out ladder gating, pending-row clearing, and one actual Apply request.
- `Jalen last 10 games` with an unresolved parser response now requires
  `Choose a player before applying these filters.` and no game-log request.
  Removing that explanation is caught at desktop and phone widths.
- The fresh review found an additional Score Matrix pressed-state omission.
  Three scoped assertions at `c48456b` address it; its exact mutant is caught.

## Rerunning the mutations

The [exact corpus](e2e-review-round1-mutations.json) preserves each old/new string
from the verifier, plus explicit real-duplicate, ambiguous-player, render-nothing,
combined-reset and Score Matrix probes. Every test command runs both widths.
From this checkout:

```sh
python3 ~/.agents/scripts/mutate.py \
  --repo "$PWD" \
  --mutations docs/e2e-review-round1-mutations.json \
  --setup 'npm ci' \
  --test 'npm run test:flows' \
  --timeout 300 \
  --log-dir /tmp/statsplus-round1-replay
```

The original Query Reference Link-state equivalent mutant is omitted as requested.
There are **26 caught mutants and three equivalent survivors**, with no timeouts,
in the 29-case #155 corpus. The runner exits 1 for the equivalent survivors; that
exit is reported rather than mislabelled as all-caught. Each original escaped
mutant was rerun, except the explicitly excluded Link-state mutant.

## Equivalent-mutant rebuttals

**O19/O20:** `OperationsPage.beginAction` and `cancelAction` each clear the reason;
successful confirmation also clears it. Removing either one reset alone leaves
Cancel → reopen visibly correct. The tests now type a reason, cancel, reopen,
require an empty reason and disabled Confirm, then submit a fresh reason and
verify its durable job for all nine action variants. Removing **both** resets
fails the empty-reason assertion at both widths. Checking hidden internal state
would not establish a user-visible failure.

**Original duplicate-call mutant:** the second synchronous `requestGameLogs`
call aborts the first via `gameLogsRequestRef.current.controller.abort()` before
Axios's asynchronous request interceptor transmits it. The transport probe in a
disposable copy prints `HTTP Apply delta: 2 3` on desktop and phone for both
baseline and mutant. It therefore does not send a duplicate HTTP request.
The supplemental mutant calls `fetchGameLogsData` independently during Apply;
that actually sends two requests and fails the exact-count assertion at both
widths. Full probe logs: `/tmp/statsplus-fix-round1-155-main/duplicate-probe/`.

## Mutation output

All runs use `python3 ~/.agents/scripts/mutate.py` with `npm ci` in disposable
copies, never editing application files in the reviewed worktrees. Baselines
passed before each mutation. The output below excludes only temporary worktree
path lines. Full baseline/failure logs are retained in the named directories.

### Workspace, Search, reference, saved dialogs and analytics

Source: `/tmp/statsplus-fix-round1-155-main/mutation-output.txt`.

```text
CAUGHT     1 averages decoded empty
CAUGHT     2 AppliedFilters badges not rendered
CAUGHT     3 reference clauses table empty
CAUGHT     4 ladder enabled when signed out
ESCAPED    5 panel apply sends duplicate request
CAUGHT     6 save error stale on reopen
CAUGHT     7 save name field not cleared on reopen
CAUGHT     8 stale rows kept while next request in flight
CAUGHT     9 PlayerStatsCards renders nothing
CAUGHT    10 PerformanceAverages renders nothing
summary: 9 caught, 1 escaped or timed out, of 10
ALLDONE
```

### Date, Matchup, Target and Operations controls

Source: `/tmp/statsplus-fix-round1-155-controls/mutation-output.txt`.

```text
CAUGHT     1 S10 Previous date shifts +1 day
CAUGHT     2 S11 Today button goes to fixed 2000-01-01
CAUGHT     3 S12 Today never disabled on today's slate
CAUGHT     4 S13 invalid-date client message removed
CAUGHT     5 S14 date input shows today instead of slate date
CAUGHT     6 M14 Close button is a no-op
CAUGHT     7 M16 selection card not focused on open
CAUGHT     8 M17 team toggle never aria-pressed
CAUGHT     9 M18 stat category never aria-pressed
CAUGHT    10 M19 player selection replaces history entry
CAUGHT    11 M20 selection log stat tile never aria-pressed
CAUGHT    12 T18 Conditions to-date not sent
CAUGHT    13 T23 Slate fits not filtered per game
ESCAPED   14 O19 opening a dialog keeps previous reason
ESCAPED   15 O20 Cancel keeps typed reason
CAUGHT    16 O19+O20 Cancel and reopen both retain typed reason
summary: 14 caught, 2 escaped or timed out, of 16
ALLDONE
```

### Actual duplicate HTTP request and ambiguous-player guidance

Source: `/tmp/statsplus-fix-round1-155-main/additional-final-output.txt`.

```text
CAUGHT     1 Apply emits two HTTP requests
CAUGHT     2 ambiguous player explanation removed
summary: 2 caught, 0 escaped or timed out, of 2
ALLDONE
```

### Additional Score Matrix regression

Source: `/tmp/statsplus-fix-round1-155-controls/matrix-output.txt`.

```text
CAUGHT     1 B6 market aria-pressed always false
summary: 1 caught, 0 escaped or timed out, of 1
ALLDONE
```

### PR #157 request waits

Source: `/tmp/statsplus-fix-round1-157/mutations.out`.

```text
CAUGHT     1 C1 clearing a control clears its parameter: Apply never fetches + stray identical read 300ms later
CAUGHT     2 C1 removing every self filter clears its parameter: Apply never fetches + stray identical read 300ms later
CAUGHT     3 R1 request layer re-adds game_filter=10 when URL has none (T2 URL ok, request wrong)
CAUGHT     4 R2 request layer re-adds self_filters[PTS]=20,60 when URL has none (T3)
CAUGHT     5 R3 request layer drops season_filter from main request (T1)
CAUGHT     6 R4 request layer drops game_filter from main request (T1)
CAUGHT     7 Duplicate Apply clearing a control clears its parameter
CAUGHT     8 Duplicate Apply removing every self filter clears its parameter
summary: 8 caught, 0 escaped or timed out, of 8
ALLDONE
```

The #157 positive controls are in
`/tmp/statsplus-fix-round1-157/positive-controls.json` and its control logs;
their expected `ESCAPED` labels mean valid behavior remains accepted, not that
defects escaped. See `/tmp/statsplus-fix-round1-157/REPORT.md` for exact commands,
all eight mutation results, and standalone gate evidence.

The first supplemental duplicate probe compared a numeric filter to a string,
so it never triggered its inserted request; the corrected recorded corpus uses
the presence of the filter. It is the corrected run above that establishes the
request-count regression. No application fix was needed.
