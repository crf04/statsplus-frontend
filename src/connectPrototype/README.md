# Connect page prototype (throwaway)

Branch `prototype/connect-page-look`. Asked 2026-10-13: refresh the MCP
(Connect) page and mention it on the home page.

Variants ride the URL hash, never the query string (on `/` the query string
is the Filter Set). A floating switcher at bottom left changes them.

- `/connect#v=A` polished guide: URL in the hero, five tools as cards, step dots
- `/connect#v=B` chat preview: a real connector answer (Cade vs CHA, 2025-26) beside the URL, tabbed setup
- `/connect#v=C` three steps: 01 copy, 02 add (tabbed), 03 ask
- `/connect#v=D` box score: the landing floor and outline type, tools as a table
- `/#h=1` eyebrow pill above "Ask the box score"
- `/#h=2` a third door under Browse
- `/#h=3` a card under the query ladder
- `/#h=4` a ticker strip pinned to the bottom of the viewport

Gated by `PROTO_ENABLED` (dev, or `REACT_APP_PROTOTYPE=connect`).

## Verdict (round 1, 2026-10-13)

Home **1** (eyebrow pill) and Connect **B**, with the connector's actual card
instead of the mock, and the example queries kept. Round 2:

- B embeds the real Matchup card (`public/connect-proto/matchup-card.html`,
  served HTML from statsplus-mcp main) in an iframe; `RealCard.js` plays the
  MCP Apps host and sends `matchupCard.json`, the structuredContent of a live
  production `get_matchup(player="Cade Cunningham", opponent="CHA")`.
- Every example query was run against production on 2026-10-13 and answers
  (`What's on tonight's slate?` was replaced: 0 games in the offseason).
