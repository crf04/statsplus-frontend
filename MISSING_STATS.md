# NBA Stats Availability Notes

This document summarizes which team and player statistics are currently expected to be available through the backend API, plus metrics that may need calculation or additional backend support.

## Available Stats

### Traditional

Based on the NBA API `LeagueDashTeamStats` data used by the backend:

- Points (`PTS`)
- Rebounds (`REB`)
- Assists (`AST`)
- Field goals made/attempted (`FGM`, `FGA`)
- Three-pointers made/attempted (`FG3M`, `FG3A`)
- Free throws made/attempted (`FTM`, `FTA`)
- Steals (`STL`)
- Blocks (`BLK`)
- Turnovers (`TOV`)
- Wins and losses (`W`, `L`)

### Advanced

Expected from NBA advanced team stats:

- Offensive rating (`OFF_RATING`)
- Defensive rating (`DEF_RATING`)
- Pace (`PACE`)
- True shooting percentage (`TS_PCT`)
- Effective field goal percentage (`EFG_PCT`)
- Turnover percentage (`TOV_PCT`)

### Play Types

- Pick and roll
- Isolation
- Post-up
- Spot-up
- Transition
- Cut
- Hand-off
- Off screen

### Assists

- Assist patterns from the backend's processed assist data

### Zone Shooting

- Paint shooting
- Mid-range shooting
- Three-point shooting by zone
- At-rim shooting

### Shooting Type

- Catch and shoot
- Pull-ups
- Less than 10 feet

## Metrics That May Need Calculation

### Team Efficiency

- Net rating, calculated as offensive rating minus defensive rating
- Plus/minus, calculated from game logs if not provided directly
- Team rebounding percentage, calculated from available rebound totals when opponent context exists

### Defensive

- Opponent field goal percentage by zone, depending on zone shooting coverage
- Defensive rebounding percentage, if rebound context is available
- Combined steals and blocks, which can be calculated from existing fields

### Team Context

- Bench points, if player rotation and starter/bench classification are available
- Points in the paint, if included in the backend source data
- Fast break points, if included in the backend source data
- Second chance points, if included in the backend source data

## API Endpoints

- `GET /api/teams/stats?team={team}&category=Traditional`
- `GET /api/teams/stats?team={team}&category=Playtypes`
- `GET /api/teams/stats?team={team}&category=Zone Shooting`
- `GET /api/teams/stats?team={team}&category=Assists`

## Notes for Contributors

- Prefer showing clearly available stats before adding UI for derived or partially supported metrics.
- If a metric is derived, document the formula near the implementation.
- Validate any newly exposed stat against backend responses before adding it to filters, cards, or chart labels.
