# Target opponent context

The normal target edit page, New Target modal, and Defense Sheet capture form use
the approved compact filter card. Why sits beside the opponent; category names
remain complete, subcategory selectors stay narrow, and each filter shows the
matching opponent rank and percentage difference. The backtest summary and hit
grid sit below the form, with game rows beside it on desktop and below on phones.
There is no full team-stat browsing panel or prototype switcher.

The visual studies remain on `prototype/targets-team-context` at `75faa9d`.
`feature/target-opponent-context` contains the production implementation; no query
parameter is needed. Saved targets, notes, conditions, stat preferences, Save,
Revert, Delete, and preview continue through the existing production APIs.

## Opponent reads

`opponentContextApi.js` owns the API mapping and response normalization.
`useOpponentContext.js` owns a bounded, per-form cache and cancellable reads. One
opponent/category response covers every qualifier in that base; changing only a
threshold or slice does not refetch. Changing opponents immediately hides old
context and cancels old reads. Late responses cannot populate the new opponent.
Errors are retryable without clearing valid profiles in other bases or blocking
target editing/saving. Invalid or missing figures remain unavailable, never zero.

| Player base      | Team category   | Opponent value and comparison                                                  |
| ---------------- | --------------- | ------------------------------------------------------------------------------ |
| Play types       | Playtype Points | Exact play-type points allowed per 48, rank, vs-average percent                |
| Shot types       | Shooting Type   | Exact shot-type combined FGA allowed per 48, combined rank, vs-average percent |
| Shot zones       | Zone Shooting   | Exact zone OPP_FGA, rank, vs-average percent                                   |
| Assist locations | Assists         | Exact assist-location volume index, rank, (index − 1) × 100                    |

Ranks 1–10 (least allowed) are red, 21–30 green, and the middle third neutral.
Differences ≤−5% are red and ≥+5% green; the middle range is neutral. Numeric
signs, rank suffix, metric labels, and explanatory tooltips remain visible.

## Backend prerequisite and release order

Deploy the backend changes before the frontend:

1. `Playtype Points`, already implemented on the backend feature branch, adds
   points allowed per 48 without changing legacy `Playtypes` PPP indices.
2. `Shooting Type` adds `FGA`, `FGA_RANK`, and `FGA_vs_avg_pct` to each row.
   These combine FG2A and FG3A across the league before ranking or averaging.
   Existing component fields, authentication, and publication/error behavior stay
   intact. Missing/zero-mean comparisons are unavailable rather than fabricated.

This work is implemented locally, not deployed. If the frontend is released
before its backend prerequisite, the affected context will show unavailable.
The production frontend retains its normal same-origin API routing; the local
read-only API used for verification is not shipped in frontend code.

## Verification

- Frontend: lint, Prettier, unit/API/hook tests, production build, and browser
  journeys. New tests cover every qualifier mapping, total-attempt rank semantics,
  cancellation and stale-response suppression, deduplicated reads, retries, and
  real Save/preview behavior when context is unavailable.
- Backend: combined-volume rank regression over asymmetric two-/three-point
  attempts, existing contract compatibility tests, full gate with branch coverage,
  repeatable migrations, and demo database validation.
- Coordination: endpoint/catalogue contract check and shared tests.
- Live authenticated normal-route edit/create captures use production data at
  desktop and phone widths, including real minutes-preview updates. Additive
  backend fields were served by the actual local service against a read-only
  production database; other traffic went to Railway. No account records were
  created, changed, or deleted during live screenshot QA.

[Edit desktop](target-opponent-context/edit-desktop.png) ·
[Edit phone](target-opponent-context/edit-phone.png) ·
[Create desktop](target-opponent-context/create-desktop.png) ·
[Create phone](target-opponent-context/create-phone.png)

Final implementation validation: 717 frontend tests and 108 browser tests passed
(2 browser tests skipped), alongside lint, formatting, and production build.
Backend gate: 4,762 tests and 62 subtests passed with 84.76% branch coverage;
repeatable migrations and demo validation passed. Coordination gate passed.
Independent Claude review verified the mapping, cancellation, retry, color
boundaries, and transient stale-opponent guard with mutation checks; all material
findings were resolved and temporary mutations restored before the final gate.
