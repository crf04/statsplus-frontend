> Archived visual studies. The approved design is now implemented by the normal target form; see [production implementation](../features/target-opponent-context.md). Source variants remain on `prototype/targets-team-context` at `75faa9d`.

# Opponent context while creating and editing Targets

Throwaway continuation on `prototype/targets-team-context`, following the list-page exploration at `da7d22f`. No winner selected.

## User direction (unedited)

> It's more relevant when creating a target, so I kind of want it on the edit page and the create modal

> still give me a couple prototypes

## Two options

- **A — Inline table:** a compact collapsible opponent-context table above the qualifiers.
- **B — Split context panel:** opponent stats beside the form on desktop, stacked on a phone.

The create modal offers both options. The edit route now shares one collapsible context panel beneath the qualifiers, closed initially, and keeps minutes controls on the left and backtest status, summary, and game rows on the right. Qualifier cards include inline opponent rank and percentage difference from league average. The selected draft opponent controls the stats. Adding a stat appends a qualifier with an empty threshold; selecting an existing qualifier highlights it without changing its threshold. Saves and stat selections stay in memory.

Run `npm run prototype:team-context` with the normal development Firebase/API configuration.

- Create: `/targets?contextPrototype=1&variant=A&compose=1` (or `variant=B`).
- Edit: `/targets/<saved-target-id>?contextPrototype=1&variant=A` (or `variant=B`).

The create page keeps the saved-target list layout. The development-only query flag enables this exploration; normal routes retain their behavior. No tracker items or PR were published.

## Data and verification

Real authenticated existing `/api/teams` and `/api/teams/stats` reads. All volume stats are per 48; Playtypes compare points per possession to league average, and Assists use league-relative indices. Whole-season snapshots; no date filter. Rank 1 means lowest value, not universally best defense. Backtest preview POSTs compute results without saving a target.

Cross-vendor review identified the Clippers display-name mismatch; opponent lookup now resolves the live team list through the tricode mapping.

## Evidence

[Create/edit, desktop/phone gallery](target-composer-context/index.html). [Restored game rows on phone](target-composer-context/edit-games-phone.png). Frontend base `da7d22f46b3952cec6f3469471f487d4d098e56f`; backend contract reference `81cefe05915b9f931eaa26937c7fae560551bc98`.

- Existing unit suite: 683 passed (43 suites). Existing browser suite: 107 passed, 2 deployment-only checks skipped.
- Real authenticated browser checks: selected existing ORL qualifier without duplication or threshold changes; appended Isolation; switched A/B with draft intact; edited and saved locally; reload restored the unchanged account target. Create flow checked LAC synchronization, switched to ORL, appended Spot up without replacing the original qualifier, switched layouts, and saved locally. Account target list remained byte-for-byte unchanged; zero account write requests.
- Captured both surfaces in both variants at 1440×900 and 390×844. No document-level horizontal overflow. Narrow tables scroll within their panels.
- Cross-vendor material finding (LAC display-name mismatch) fixed and verified live. Prototype edit title derives from the local saved draft.

No production promotion and no tracker publication. QA Vite server stopped after capture.

## Earlier edit backtest correction (superseded below)

User: “The context panel is blocking the backtest on the edit page isn't it” → “yes go ahead and fix”.

Restored `TargetLab` workbench rendering on edit. Context opens inside the qualifier column; both create variants retain their layouts. The edit column scrolls normally so long qualifier lists and the backtest summary remain reachable. Removed the edit-only A/B switcher because both URLs share this layout. Verified against frontend `d120c325b8300cb22a7b6a60ff7a93b6a0509121` plus this correction in `/Users/chrisfu/.t3/worktrees/statsplus-frontend/proto-team-context`. Live authenticated ORL target 13, both variants, desktop 1440×900 and phone 390×844: context starts collapsed, expanding preserves desktop game column x/y/width, game rows and the backtest summary remain reachable, no document overflow, zero account writes. QA server stopped.

Completion gate: lint, formatting, 683 unit tests, production build, and 107 browser tests passed (2 deployment-only skips). No new tests for this throwaway layout correction.

Independent cross-vendor review prompted the normal-scroll correction and removal of the inert edit switcher. Internal horizontal scrolling is intentional for the narrow stats table; adding a qualifier retains the established focus behavior.

Follow-up review confirmed the restored workbench and unchanged create layouts. Resolved its gallery-label and CSS-specificity findings; the bounded context table scroll remains intentional.

## Full backtest beside the editor

User clarification (unedited): “where is the backtest, it should be on the side”.

The complete backtest now occupies the right column: minutes control, preview status, summary and hit rates, then game rows. The qualifier editor and collapsible opponent context occupy the left column. On phones these columns stack. Existing create options and normal routes retain their layout.

Verified frontend `a12914147f7e8d2e950d38668d4751e8c789ac9c` plus this correction in the same prototype worktree. Full completion gate passed: lint, formatting, 683 unit tests, production build, 107 browser tests (2 deployment-only skips). Live authenticated ORL edit checks at desktop 1440×900 and phone 390×844 confirm the backtest is alongside the editor on desktop, expanding context preserves its position, and results remain reachable without document overflow.

Changing the relocated minutes slider to 20 triggered a successful real preview request with `conditions.player_minutes: 20` and returned the backtest to its up-to-date state on both viewports. Zero account writes; owned QA server stopped.

Independent review confirmed the side layout, preserved sample provider, and unchanged normal/create rendering. Restored 12px spacing below the moved controls. On phones, editor actions intentionally remain with the editor before the stacked backtest; they still save the shared draft including minutes changes. Live capture confirms the moved slider renders correctly and updates its request.

## Inline opponent evidence and left minutes filter

User direction (unedited): “i want the backtest minutes filter to stay on the left, also, maybe have the opponent rank and percentage diff vs average on the actual card, it looks a bit stretched right now in the card, mayve thi s could make the spacing better”.

Minutes filtering returns to the form on the left; backtest results remain on the right. Each qualifier card now includes an inline opponent metric label, rank, and relative percentage difference from league average in create and edit prototypes. Reads follow each qualifier and draft opponent independently of the context browser category. Play types use PPP allowed, shot types use points allowed per 48, zones use attempts allowed per 48, and assist locations use assist volume. Rank 1 means lowest; rank direction is visible on every card, including phones. This context is distinct from the player's diet-share threshold.

Verified at frontend base `66b28ce` plus these changes in the prototype worktree. Live ORL desktop and phone checks confirm each qualifier has rank and difference, minutes is in the left editor, backtest results remain alongside on desktop, expansion does not displace results, and changing minutes still sends the correct preview request. No account writes or document overflow. Fresh screenshot filename: [inline opponent evidence](target-composer-context/edit-inline-rank-left-minutes.png).

Full completion gate passed: lint, formatting, 683 unit tests, production build, 107 browser tests (2 deployment-only skips). Both create variants were captured with live authenticated data at desktop and phone widths. Phone card footers keep rank and difference together beneath the metric label. QA services stopped after capture.

Cross-vendor review confirmed the requested layout and qualifier mapping. Fixed unavailable-team loading, preserved category data when changing a slice, pinned shot-type evidence to PTS, and made rank direction visible. Duplicate category reads across cards remain a deliberate throwaway-prototype limitation; request sharing is deferred.

## Match the player's volume stat to opponent volume

User clarification (unedited): “the catch & shoot should use ORL catch and shoot against stats, map each player stat to the opponent stat” → “Attempts allowed, matching the player stat”.

| Player qualifier           | Opponent comparison for the same slice       | Current source                                                                          |
| -------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Shot type FGA share        | Two-point + three-point attempts allowed /48 | `Shooting Type`, matching `ShootingType`, sum `FG2A + FG3A`                             |
| Shot zone FGA share        | Zone FGA allowed /48                         | `Zone Shooting`, matching zone `_OPP_FGA`                                               |
| Assist location share      | Assists allowed in that location             | `Assists`, matching location's volume index and rank                                    |
| Play type possession share | Possessions allowed in that play type        | Unavailable: current Team Stats API exposes PPP only; no efficiency rank is substituted |

Shot-type ranking uses all 30 teams' summed attempts, with ascending competition rank and percentage difference from the mean of those totals. Never sums or averages component ranks, differences, or point totals. Missing components or incomplete league coverage make the comparison unavailable. Profile reads are shared in memory across cards. Each footer names the opponent and exact player slice.

Verified at frontend `595bb54` plus this change. Authenticated live create A/B and edit captures at 1440×900 and 390×844 pass; left minutes control updates the actual preview transport, right results stay in place, no account writes or document overflow. Full owning gate passes: lint, formatting, 683 unit tests, build, 107 browser tests (2 deployment-only skips). QA services stopped. [Fresh attempts-mapping screenshot](target-composer-context/edit-opponent-attempts-mapping.png).

Production Team Stats contract inspected at backend reference `81cefe05915b9f931eaa26937c7fae560551bc98` and confirmed against live responses. No API or backend changes made. Play-type volume remains an explicit data limitation of this prototype.

Independent read of all 30 live shooting profiles confirmed ORL Catch & Shoot: 24.7745839637 FGA/48, league mean 28.0072707804, ascending rank 1, relative difference −11.5423128590%. Cross-vendor review confirmed mappings and math; no blocking findings. Complete 30-team coverage is intentional for a league rank, rather than ranking a partial sample. Opponent names come directly from the same team list after tricode matching. The prototype's shared whole-season reads remain fixed until page reload; they are not a production freshness mechanism. The named slice plus FGA label identifies the exact attempt population; the card intentionally displays rank/difference as requested, not another raw-value tile.

## Play types: points allowed only

Final user direction (unedited): “just do points allowed”.

Play-type qualifier cards and the context browser now read `Playtype Points` and show matching points allowed per 48, rank, and percentage difference from average. Shot types keep summed attempts, zones keep FGA, and assist locations keep assist volume. Minutes remains left and backtest results right.

The additive backend category is implemented in `/Users/chrisfu/.t3/worktrees/statsplus-backend/proto-target-playtype-points` from base `48b9ab97712de02b26e18f8145a53b3330198632`; it preserves the original PPP `Playtypes` category. Backend gate: 4,761 tests and 62 subtests passed, branch coverage 84.75%, migrations and demo validation passed. Frontend gate: lint, formatting, 683 unit tests, build, 107 browser tests passed (2 deployment-only skips). Coordination contract gate passed with explicit repository overrides.

Integrated capture uses the actual local backend route/service/publication reader against a PostgreSQL connection forced read-only to the production database. Only `category=Playtype Points` is proxied there; all other frontend API traffic goes directly to production Railway with real authentication. No fixtures or substituted responses. This is local integration evidence, not evidence of deployment: production still needs the additive category. ORL Spotup returned 24.0121 PTS/48, rank 2, −13.0465%; Isolation returned 8.7262 PTS/48, rank 30, +21.0282%.

Backend implementation captured at `8d2cd23626a2db8bbb4db100aebb8464f6c7ad82`. Fresh cross-vendor re-review found no material issues. The new route test was mutation-verified: switching to possessions and switching to PPP each failed, then the source was restored and all 12 route tests passed. The full gate preceded the strengthened test fixture; focused route tests, frontend lint/unit/build, and coordination checks passed afterward. Browser fixture covers all eleven play-type keys. No extra prototype frontend tests added. Owned Vite and read-only local backend stopped; no production deployment performed. [Updated points screenshot](target-composer-context/edit-playtype-points-allowed.png).

Rank-label follow-up: user requested “just do standard 1-30”. Inline cards now show `#N/30` without “rank · 1 lowest”; the ranking and missing-value behavior are unchanged. Review suggested retaining visible direction text; this was rejected because it directly conflicts with the requested wording change.

## Always-visible team stats

User (unedited): “show me the screen, i dont really want the team stats folded up like that, i think theres a better way to show it, i do like the current structure thouhg”.

Replaced the edit accordion with a permanent team stats section below the qualifiers and minutes control. Category tabs and all rows remain rendered; the right-side backtest layout stays intact. Create modal variants retain their prior behavior. Added a prototype-scoped page background so long captures and the full scrolling surface have a continuous dark background.

Verified frontend base `161ef3e` plus this correction. Full owning gate passed (lint, formatting, 683 unit tests, build, 107 browser tests; 2 deployment-only skips). Cross-vendor review confirmed layout preservation; its table-padding finding was fixed by sharing the 16px wrap rule with the side-panel variant. Cosmetic padding/background corrections passed formatting afterward.

Live ORL edit at 1440×900 and 390×844: no summary toggle; all 11 play-type rows present; switching to zones renders all 10 rows and returning restores 11; desktop backtest document position/width unchanged; no document overflow; minutes filtering still updates the real preview. Same read-only local points API plus direct Railway reads described above; no account writes. Owned QA services stopped. [Full desktop screen](target-composer-context/edit-team-stats-visible-desktop.png), [phone screen](target-composer-context/edit-team-stats-visible-phone.png).

### Filter card studies (2026-09-09)

Question: retain all filter controls and opponent information, but make the card easier to read.
Three throwaway layouts share the existing editor and create modal, selected with
`cardVariant=A`, `B`, or `C` alongside `contextPrototype=1`:

- A — Stacked: category and slice above the slider, opponent evidence in a footer.
- B — Split: filter controls beside a dedicated opponent rank column; slider spans the phone card.
- C — Compact: slice first, opponent evidence beneath it, slider last, with simple row dividers.

[Desktop and phone gallery](filter-card-studies/index.html). No winner selected.
Draft values survive switching; arrows operate the active filter-card study while
layout A/B remains clickable in the composer. Focused inputs retain arrow-key behavior.
Minutes remain left, backtest results right, and edit team stats permanently open.

Verification against frontend base `41ec5e9`, backend `8d2cd23`:
existing lint, formatting, 683 unit tests, build, and 107 E2E tests passed (2 deployment skips).
Live authenticated desktop/phone checks cover all three editor layouts, category
switching, visible rank/difference values, no horizontal overflow, and minutes changes
through the real preview transport. Create-modal checks cover all three card layouts,
draft preservation on switch, and slider keyboard behavior. No account writes.
Play-type points use the local additive route with read-only production data;
other API requests go to Railway. No API deployment or new tests in this visual study.
Fresh Claude review prompted keyboard guards and distinct switcher placement;
filter CSS is scoped to qualifier descendants to protect the minutes control.

Followup review identified composer mobile specificity collisions; explicit variant
grid and remove-button placement now outrank modal defaults. Recaptured all three
phone composer variants and visually confirmed the split column and remove control.

### Combined filter header

User correction: category must precede slice when reading left to right. Updated C
to put category, slice, and opponent/rank/difference in one desktop header; removed
the duplicate opponent slice label. The metric unit remains beneath the comparison.
Phone wraps opponent evidence beneath the two selectors. A and B remain available.

[Updated desktop](filter-card-studies/unified-filter-row-desktop.png) ·
[Updated phone](filter-card-studies/unified-filter-row-phone.png).

Verified against base `9d056cd`: live authenticated edit checks at desktop/phone
widths, correct rank/metric labels, no overflow, unchanged side backtest, category
switching, and live minutes preview. Create checks exercise variant switching and
keyboard threshold changes. Production API routing remains as documented above.

Completion: lint, formatting, 683 unit tests, build, and 107 E2E tests passed
(2 deployment-only skips). Fresh cross-vendor review found no desktop control or
state regressions. Retained the phone's inline metric intentionally: the user's
request is compact presentation, and live 390px captures show all comparison data
without overflow. The review's proposed mandatory phone metric line was not a user
requirement. Opponents use fixed three-letter tricodes, not long team names.

### Aligned typography

The category inherited legacy uppercase monospace styling. Prototype C now uses
matching sans-serif, size, weight, and casing for both selectors, and sans-serif
for opponent evidence. Compact category names (Shots, Plays, Zones, Assists) keep
the 82px dropdown readable. Fresh captures: [desktop](filter-card-studies/filter-aligned-font-desktop.png)
and [phone](filter-card-studies/filter-aligned-font-phone.png).

Verified from base `3acd718`: live desktop/phone edit and create checks, lint,
formatting, unit tests, build. Initial E2E run had 102 passes and five Target
failures during a source hot reload; all 16 Target tests passed on rerun after
edits stopped (two deployment-only skips in the full suite). Cross-vendor CSS
review found no material issues. Screenshot inspection prompted the short labels.

### Correction: narrow the subcategory, preserve category names

Supersedes the short-name experiment above: full category labels are restored.
The category track is 132px; the subcategory track is capped at 140px instead of
stretching. Matching typography remains. [Fresh desktop](filter-card-studies/full-category-narrow-slice-desktop.png)
and [phone](filter-card-studies/full-category-narrow-slice-phone.png).

Base `ab83196`; lint, formatting, 683 unit tests, build, and 107 E2E tests pass
(2 deployment skips). Live desktop/phone checks pass after retrying an incomplete
opponent-context read. Fresh review's phone-overflow concern was checked in Chromium:
a 250px grid resolves to 132px/80px/18px with scrollWidth 250, confirming the
minmax(0,140px) subcategory track shrinks. No category labels are abbreviated.

### Opponent cell refinement

User (unedited): “offload to fable 5.1 to improve the design of just the opponent card”.

Only the opponent block in prototype C changed. It is now a divided cell beside the
selectors: a caption line names the opponent and metric unit (`ORL · FGA allowed /48`),
and a figures line below carries the rank and signed difference at 15px, with `/30` and
`vs avg` dimmed so the numbers lead. Phones keep the caption and figures on one wrapping
line beneath the selectors. Selectors, widths, typography, minutes placement, backtest
column, and team stats are unchanged; variants A and B render as before. No data or
mapping changes. [Edit desktop](filter-card-studies/opponent-cell-desktop.png) ·
[edit phone](filter-card-studies/opponent-cell-phone.png) ·
[create desktop](filter-card-studies/opponent-cell-create-desktop.png) ·
[create phone](filter-card-studies/opponent-cell-create-phone.png).

Base `47efde5`, backend `8d2cd23`. Live authenticated edit and create captures at
1440×900 and 390×844 passed the existing harness checks: both cards show rank and
difference, shot-type metric label, minutes left, backtest beside the editor and not
displaced, no overflow, live minutes preview, zero account writes. Play-type points used
the local read-only additive route; other requests went to Railway. Completion gate:
lint, formatting, 683 unit tests, build, 107 E2E (2 deployment-only skips). No new tests
for this visual change. Owned QA services stopped.
Cross-vendor review found one material issue: splitting the rank into `#N` and `/30`
left variant B's suffix at 11px instead of 23px. Fixed by widening B's size rule; live
A and B recaptures match their earlier renderings. No other findings.

### Opponent value colors

Ranks 1–10 use the existing red token (least allowed), 21–30 green (most
allowed), and 11–20 neutral. Differences at or below −5% are red, at or above
+5% green, otherwise neutral. Missing values remain neutral. Only numeric
figures change color; signs, /30, metric labels and vs-average text remain.
Tooltips explain the thresholds. [Desktop](filter-card-studies/opponent-colored-values-desktop.png)
and [phone](filter-card-studies/opponent-colored-values-phone.png) captured with
live authenticated ORL data; existing layout/metric/minutes checks pass.

### Shorter filters and simpler note copy

Variant C reduces vertical padding, row gaps, slider padding, and spacing between
qualifiers. The threshold and league marker retain their labels; opponent figures
and selectors are unchanged. Note placeholder now says "optional", with matching
accessible label and existing test selectors updated.
[Desktop](filter-card-studies/filters-compressed-desktop.png) ·
[Phone](filter-card-studies/filters-compressed-phone.png).

Base `73038f1`: lint, formatting, 683 unit tests, build, and 107 E2E tests passed
(2 deployment skips). Live edit desktop/phone checks passed for layout, metrics,
category switching, no overflow, and minutes preview. No new tests added.
Create desktop/phone switching and keyboard-slider checks also passed. Fresh
cross-vendor review requested a visual clearance check; desktop/phone captures
confirm threshold values and league labels remain separate from opponent text.

### Dropdown boundaries

Variant C's category and subcategory selectors now have a subtle theme border,
surface fill, 6px horizontal padding, 32px minimum height, hover feedback, and
an explicit keyboard focus ring. Existing widths, labels, fonts, and compact
filter spacing remain. [Desktop](filter-card-studies/dropdowns-outlined-desktop.png)
and [phone](filter-card-studies/dropdowns-outlined-phone.png) captured live from
base `df4e3a6`; edit layout/metric/no-overflow/minutes checks passed.
Completion gate passed: lint, formatting, 683 unit tests, build, 107 E2E tests
(2 deployment skips). Live create desktop/phone switching and keyboard checks pass.
Fresh cross-vendor review called the base border redundant, but TargetWorkbench.css
`.target-form .target-qualifier > select` overrides the page's select border and fill
with border:0 and transparent. This scoped rule restores visible boundaries, confirmed
in before/after live captures. Existing disabled-state dimming is preserved.

### Why beside the opponent

Prototype C moves the existing Why note field into the top row beside the team
name/picker in edit and create. One field retains the same draft binding, optional
label, maximum length and disabled state. The former bottom placement remains
for other variants and the production form. Header flex sizing keeps the input
beside the team at phone width. [Desktop](filter-card-studies/why-next-to-team-desktop.png)
and [phone](filter-card-studies/why-next-to-team-phone.png) captured with live data.
Verified from `f914e4a`: lint, formatting, 683 unit tests, build, and 107 E2E tests
pass (2 deployment skips). Live edit/create desktop and phone checks pass. Fresh
cross-vendor review confirmed state/placement isolation; visual inspection confirms
the phone input has ample space and the desktop border matches the requested
structured controls. Owned QA services stopped.

### Backtest below the filter card

Supersedes the side-backtest/open-team-stats decision on the edit page: remove the
full team-stats panel and place summary, hit grid, and games below the editor.
The editor remains capped at its existing 510px desktop width to preserve the
current card format. Backtest results use the available page width. Inline opponent
context and minutes remain in the editor; create modal layouts are unchanged.
[Desktop](filter-card-studies/backtest-below-card-desktop.png) ·
[Phone](filter-card-studies/backtest-below-card-phone.png).

Live authenticated checks confirm results below editor, full stats absent, inline
opponent figures retained, no overflow, reachable summary/games, and a working
minutes-preview request. Root background is scoped to the edit workbench now that
its old team-panel anchor has been removed.
Completion gate from `7979ab5`: lint, formatting, 683 unit tests, build, and
107 E2E tests pass (2 deployment skips). Fresh cross-vendor review confirmed
placement/card isolation. Its root-background finding is rebutted: this preserves
the existing ink background formerly activated by the removed inline panel;
scoping only to the workbench previously left white below the viewport in full-page
captures. The new selector remains conditional on this prototype workbench.

### Correction: summary left, games right

The backtest summary and hit grid belong beneath the filter/minutes cards on the
left; only the actual game list belongs on the right, as in TargetLab's production
branch. The prototype now matches that content grouping, retaining all current
card internals and keeping full team stats removed. Phone stacks games after the
left-column content. [Desktop](filter-card-studies/summary-left-games-right-desktop.png)
and [phone](filter-card-studies/summary-left-games-right-phone.png).

Live checks from `e82aacc` confirm summary below form, desktop games beside editor,
inline opponent figures retained, team panel absent, no overflow, and live minutes
updates through the actual preview transport. QA services stopped after capture.
Completion gate passed: lint, formatting, 683 unit tests, build, 107 E2E tests
(2 deployment skips). Fresh cross-vendor review prompted restoring desktop sticky
behavior for the editor column, matching the default workbench. Its spacing concern
is covered by TargetWorkbench.css `.target-workbench .target-form` margin-bottom:
12px, confirmed in the live capture. Card formatting remains unchanged.
