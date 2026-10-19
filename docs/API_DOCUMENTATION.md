# API documentation

Boundary fields the frontend decodes. The coordination repository
(`crf04/statsplus`) owns the contract; this file records what the decoder in
`src/matchups/matchupApi.js` accepts.

## `GET /api/games/matchup`: `players[].line_prices`

Per-pick Over and Under prices from the providers whose price sits on one
pick. They feed the best-price line under each upcoming rail row (parent
statsplus#247).

```json
"line_prices": {
  "underdog": { "PTS": { "over": -112, "under": -112 } },
  "novig":    { "PTS": { "over": -106, "under": -102 } }
}
```

- Providers are `underdog`, `novig`, `polymarket` and `kalshi`. PrizePicks and
  Dabble (entry-scope multipliers) never appear.
- A market appears only where `lines[provider][market]` exists, and prices that
  line.
- `over` and `under` are integer American prices, or `null` when that side has
  no price. A market with both sides `null` is omitted.
- Game-log participants (historical and unscheduled Matchups) and rows stored
  before prices were recorded carry `{}`. An absent field decodes as `{}`.

The decoder rejects a provider outside the four, a market missing from that
provider's `lines`, a non-integer price, a missing side, and a market whose
sides are both `null`.

The rail combines these with `book_lines[stat].books`: the sources at the priced
line are every sportsbook entry at that line plus every provider whose
`lines[provider][stat]` equals it. The highest American price wins; ties go to
the sportsbooks as served, then `underdog`, `novig`, `polymarket`, `kalshi`. The
priced line is the headline line when any priced source quotes it, otherwise
the line most sportsbooks post (ties to the lower line), labelled `books {line}`.
