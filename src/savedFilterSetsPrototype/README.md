# PROTOTYPE — Saved Filter Sets list

Throwaway. Lives on branch `prototype/saved-filter-sets-look`; nothing here
should reach `master`.

**Question:** what should the saved player-matchup link list look like, given
each item carries only `{ id, name, queryString }` and arrives newest-first?

Three variants of the saved list, rendered on the existing `/` route in place
of the shipped `SavedFilterSetsModal`, switchable from the floating bar at the
bottom of the screen (or `←` / `→`).

## Run it

```
npm start
```

then open <http://localhost:5173/#proto=saved> — the list opens on load,
signed in or not, with no backend running.

- `#proto=saved&v=A` — **Roster rows.** Modal of dense two-line rows; the name
  plus the player and one chip per parameter the link carries, opponent chips
  including their paired rank. Whole row opens. Manage column appears on hover;
  delete confirms in place.
- `#proto=saved&v=B` — **Grouped by player.** Player first, name second, with a
  filter field across names/players/filters and an explicit Manage toggle.
- `#proto=saved&v=D` — **Filters first.** The player leads, the chips carry the
  row at full size, and the saved name drops to a caption. The name is typed in
  a hurry and the natural-language query is never stored, so the parameters are
  the only reliable description of a link.
- `#proto=saved&v=C` — **Drawer + preview.** Right-hand drawer over a still
  visible Workspace; names on the left rail, the whole decoded Filter Set and
  the raw query string on the right, Open as one deliberate affordance.

The variant lives in the **hash**, not the query string, because on `/` the
query string _is_ the Filter Set and an undecodable parameter there is a link
the app refuses.

## What is real and what is not

- Real saved Filter Sets are used when the API returns any; otherwise
  `fixtures.js` stands in so density is judgeable. The switcher says which.
- Rename and delete are in-memory stubs. Open really navigates.
- Everything the rows show beyond the name is decoded client-side from the
  saved query string by `describe.js`. That decoding is the substance of the
  proposal — the shipped list shows a bare name.

## Removing it

Delete this folder and the two blocks marked `PROTOTYPE (throwaway)` in
`src/SavedFilterSetsModal.js` and `src/GameLogFilter.js`.
