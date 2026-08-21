# The URL is the game-log API's query string

**Status:** accepted

A Filter Set in the address bar uses the game-log API's own parameter names verbatim — `player_name`, `minutes_filter`, `players_on[]`, `teams_against[]`, `rank_filter[]`, `self_filters[STAT]`, and the rest — rather than a friendlier alias vocabulary. A link is therefore readable against the existing API documentation, and the decoder is close to `Object.fromEntries`. The cost is accepted: `self_filters[PTS]=20,60` is ugly in a URL a human might read.

## Considered options

**An alias layer** (`?player=lebron-james&last=10&at=home`) reads better and is easier to hand-type. It was rejected because it is a second vocabulary requiring its own documentation, validation, and synchronisation every time a filter is added — and any curated alias set is a subset, so the long tail (`playstyle_RTG_min`, per-stat `self_filters`) would either leak through in raw form anyway or become unreachable by URL. One vocabulary that is occasionally ugly beats two that can disagree.

**Carrying the prose of a natural-language query** alongside the filters, so a shared link could show the question that produced it. Rejected: a parameter that is displayed but never re-parsed becomes untrue the moment anyone hand-edits a filter in the URL. The applied-filter badges already state what is actually filtered.

## Consequences

Published links become a contract. Once someone bookmarks or shares one, changing the parameter vocabulary breaks it, so the API's names and this URL's names are now coupled deliberately rather than incidentally.

**Applying emits only the controls the user touched**, and untouched controls are absent so the API applies its own defaults. This follows from the decision above rather than standing on its own: the alternative — suppressing values that equal a default — requires a copy of the API's defaults in the frontend, and that copy would drift. A changed API default must not silently alter the meaning of a link someone already sent. Tracking touched-ness also preserves the distinction between "absent" and "explicitly emptied", which a value comparison cannot express.

A stray unrecognised parameter is ignored, so tracking parameters appended by a chat client or mail reader do not break a link. A recognised parameter carrying a value we cannot honour names itself and withholds the entire Filter Set, because showing results that quietly disagree with the URL is worse than refusing to show any.
