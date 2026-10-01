# Filter panel parity kit (crf04/statsplus#99)

The design reference for the Log Workspace filter panel is the prototype's
verdict J, frozen at tag `prototype/filter-panel-j` and deployed (no login) at
https://statsplus-frontend-5ta7mptdv-chris-fus-projects.vercel.app/?player_name=Jalen+Johnson&players_off%5B%5D=Trae+Young&game_filter=10#proto=filters&v=J

The real build is done when `e2e/specs/filter-panel-parity.spec.js` passes
against it with the committed baselines unchanged. Copy these into the build
branch:

- `e2e/filterPanelParity/` (this fixture and its captured data)
- `e2e/specs/filter-panel-parity.spec.js` and its `-snapshots/` directory

## What it checks

- Seven screenshots of the panel: default at 1280, 1440 and 1920 wide, an
  editor open, the opponent list expanded, saved sets expanded, and a phone
  at 390. At most 50 differing pixels per screenshot.
- Five behaviours, asserted on what the user sees and the URL Apply writes:
  - the Filter Set as rows
  - remove and apply
  - Last N quick pick
  - Own stat line ready immediately
  - the opponent "+" adds the right tier
  - a Saved Filter Set opens its URL

## Contract the build must keep

- The panel root has `data-testid="filter-panel"`.
- The accessible names in the spec, for example `Remove last`, `Apply 1 change`,
  `+ Last N`, `Add teams ranked 23–30 in Free Throws Allowed`, and
  `JJ last 10 at home`.
- The `/api/players/next-opponent` response shape in
  `data/next-opponent.json`:
  - `next_game`
  - `opponent_ranks[]` entries with `group`, `label`, `value`,
    `vs_league_pct`, `most_rank` (1 = allows the most), `ranked_teams`,
    `team_filter`, and `unit` (`count` | `percent` | `league_ratio`)

## Running

```bash
# The real build (local dev server, E2E auth, routes from the fixture)
npx playwright test filter-panel-parity --project=chromium

# The reference itself
PARITY_TARGET=prototype E2E_BASE_URL=<deployment above> \
  npx playwright test filter-panel-parity --project=chromium
```

The baselines are `chromium-darwin`. On another OS, generate that platform's
baselines from the reference deployment (the second command plus
`--update-snapshots`), never from the build.

## Proof the check is sensitive (2026-09-30)

| Run | Result |
|---|---|
| Reference, two clean runs | 12/12 passed |
| Variant I in place of J | 8 of 12 failed |
| Saved-row height +4px | 5 of 7 screenshots failed |
| Tile gap +2px | 6 of 7 screenshots failed |
| Rank-badge padding +1px | 4 of 7 screenshots failed |

## Reference baseline correction (2026-09-30)

The owner approved hiding `vercel-live-feedback`, Vercel's floating feedback
toolbar, and regenerating the seven affected baselines from the frozen reference
deployment only. The toolbar overlapped the panel in the original captures and
is unrelated to its design. The parity spec hides it alongside the prototype
switcher; the 50-pixel tolerance is unchanged. No baseline was captured from
the implementation.

Reference regeneration and clean checks used the frozen URL above with
`PARITY_TARGET=prototype E2E_BASE_URL=<frozen URL> npx playwright test
filter-panel-parity --project=chromium`; regeneration added
`--update-snapshots --grep 'panel at|panel with|panel on'`.
