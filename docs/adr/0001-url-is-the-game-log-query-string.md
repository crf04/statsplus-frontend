# The URL is the game-log API's query string

**Status:** accepted

A Filter Set in the address bar uses the game-log API's own parameter names verbatim — `player_name`, `minutes_filter`, `players_on[]`, `teams_against[]`, `rank_filter[]`, `self_filters[STAT]`, and the rest — rather than a friendlier alias vocabulary. A link is therefore readable against the existing API documentation, and the decoder is close to `Object.fromEntries`. The cost is accepted: `self_filters[PTS]=20,60` is ugly in a URL a human might read.

## Considered options

**An alias layer** (`?player=lebron-james&last=10&at=home`) reads better and is easier to hand-type. It was rejected because it is a second vocabulary requiring its own documentation, validation, and synchronisation every time a filter is added — and any curated alias set is a subset, so the long tail (`playstyle_RTG_min`, per-stat `self_filters`) would either leak through in raw form anyway or become unreachable by URL. One vocabulary that is occasionally ugly beats two that can disagree.

**Carrying the prose of a natural-language query** alongside the filters, so a shared link could show the question that produced it. Rejected: a parameter that is displayed but never re-parsed becomes untrue the moment anyone hand-edits a filter in the URL. The applied-filter badges already state what is actually filtered.

## Consequences

Published links become a contract. Once someone bookmarks or shares one, changing the parameter vocabulary breaks it, so the API's names and this URL's names are now coupled deliberately rather than incidentally.

**Applying emits only the controls the user touched**, and untouched controls are absent so the API applies its own defaults. This follows from the decision above rather than standing on its own: the alternative — suppressing values that equal a default — requires a copy of the API's defaults in the frontend, and that copy would drift. A changed API default must not silently alter the meaning of a link someone already sent. Tracking touched-ness also preserves the distinction between "absent" and "explicitly emptied", which a value comparison cannot express.

**The player is a Filter Set parameter, not a selection beside one.** Choosing a different player replaces the Filter Set in the address bar with that player and the current season, so the new player starts unfiltered: filters chosen for one player rarely suit another. A link that carries filters but no player is the exception, and there choosing a player patches `player_name` in so the filters apply. (This superseded an earlier rule that kept the applied filters across a player change.) Because the URL is the single source of truth, the applied-filter badges cannot drift from the request that produced the data underneath them.

A stray unrecognised parameter is ignored, so tracking parameters appended by a chat client or mail reader do not break a link. A recognised parameter carrying a value we cannot honour names itself and withholds the entire Filter Set, because showing results that quietly disagree with the URL is worse than refusing to show any.

**Two parameters are not part of a Filter Set: `browse` and `line_type`.** `browse` declares the intent to work without filters. `line_type` records which stat the chart and the line are drawn for, so a shared link opens on the same one. Both are views of the results rather than filters: the API never reads them, they never reach a request or a Saved Filter Set, and the decoder ignores them. Saving, matching a Saved Filter Set and deciding whether there is anything to save all read the query string without them, so the chart's stat never changes which set is current. Writing a Filter Set, including opening a saved one, carries the current `line_type` over, because rebuilding the query string from filters alone would silently reset the chart's stat; clearing every filter leaves the Workspace and drops it. The default (`PTS`) is omitted, and a value outside the Line Type options falls back to it rather than refusing the link, since there is no filter to disagree with. Changing it replaces the history entry, so Back undoes filters and not chart-stat toggles. Line Value stays out of the URL.
