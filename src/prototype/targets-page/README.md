# PROTOTYPE — the Targets page, reimagined

Throwaway. Never merge this directory into master; it lives on the branch
`prototype/targets-page-look` as the primary source for whichever look wins.

**Question:** what should `/targets` look like now that Targets resolve
against a day and open into their own page? The shipped page is a form on top
of a card grid: the composer takes the first screen, the collection is below
the fold, and every card says the same thing in the offseason.

**Plan:** three variants on the existing `/targets` route, switched by
`?proto=targets&v=A|B|C`. `date=YYYY-MM-DD` is passed through to the resolve
read so the page can be judged on a day the opponents actually played
(`2026-04-10` has MIA, NOP @ BOS on the slate). The floating bar at the bottom
steps variants and sets the date; `←`/`→` also step.

| Key | Name   | Structure                                                                                                                                     |
| --- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Ledger | One row per Target in a dense ledger; a row opens in place to show the day's readings and fits; the composer is the empty row at the foot.    |
| B   | Desk   | A rail of Targets on the left, one Target read in full on the right; "New" swaps the pane for the composer.                                   |
| C   | Board  | Today's live Targets as scoreboard tiles, idle ones as a quiet list; the composer is a sentence you fill in, which is also the derived title. |

Reads are real (`/api/user/targets`, `/resolve`). Saving is a stub: a Target
composed here is kept in memory for the session, marked _unsaved_, and never
sent to the backend.

Start: `npm start` in this worktree, then open
`http://localhost:5173/targets?proto=targets&v=A&date=2026-04-10`.
