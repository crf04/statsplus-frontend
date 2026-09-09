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
