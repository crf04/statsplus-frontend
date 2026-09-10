# Qualifier → opponent context mapping

Proposed mapping for all 23 supported qualifier slices, verified against live ORL Team Stats responses and backend `81cefe05915b9f931eaa26937c7fae560551bc98`, `app/services/team_service.py`. Latest user decision implemented in the local prototype: “just do points allowed”.

The simplified Team Stats Playtypes response exposes PPP divided by league-average PPP and a rank. The broader Matchup Defense Sheet already exposes **points allowed and possessions allowed for each play type**, each normalized per 48, with rank and percentage difference from average. They are stored under keys such as `Spotup:PTS` and `Spotup:POSS`, with Season and Last 15 windows. These are not raw season totals.

Final play-type mapping: possession share → **points allowed /48 for that exact play type**. The additive Team Stats category `Playtype Points` exposes the existing PTS column, rank, and percent difference from league average. Both inline cards and the context browser use points. The existing `Playtypes` PPP-index category remains unchanged for other consumers. The local prototype is wired; production needs the additive backend category deployed.

| Player qualifier                  | Opponent measure                     | API category and field(s)                                                |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| Transition possession share       | Transition PPP allowed               | `Playtypes`: `Transition`, `Transition_RANK`                             |
| Isolation possession share        | Isolation PPP allowed                | `Playtypes`: `Isolation`, `Isolation_RANK`                               |
| P&R ball handler possession share | P&R ball handler PPP allowed         | `Playtypes`: `PRBallHandler`, `PRBallHandler_RANK`                       |
| P&R roll man possession share     | P&R roll man PPP allowed             | `Playtypes`: `PRRollMan`, `PRRollMan_RANK`                               |
| Spot up possession share          | Spot up PPP allowed                  | `Playtypes`: `Spotup`, `Spotup_RANK`                                     |
| Cut possession share              | Cut PPP allowed                      | `Playtypes`: `Cut`, `Cut_RANK`                                           |
| Handoff possession share          | Handoff PPP allowed                  | `Playtypes`: `Handoff`, `Handoff_RANK`                                   |
| Off screen possession share       | Off screen PPP allowed               | `Playtypes`: `OffScreen`, `OffScreen_RANK`                               |
| Post up possession share          | Post up PPP allowed                  | `Playtypes`: `Postup`, `Postup_RANK`                                     |
| Putback possession share          | Putback PPP allowed                  | `Playtypes`: `OffRebound`, `OffRebound_RANK`                             |
| Catch & shoot FGA share           | Catch & shoot attempts allowed /48   | `Shooting Type`: row `ShootingType = Catch and Shoot`, sum `FG2A + FG3A` |
| Pull-up FGA share                 | Pull-up attempts allowed /48         | `Shooting Type`: row `ShootingType = Pullups`, sum `FG2A + FG3A`         |
| Inside 10 ft FGA share            | Inside 10 ft attempts allowed /48    | `Shooting Type`: row `ShootingType = Less Than 10 ft`, sum `FG2A + FG3A` |
| Restricted area FGA share         | Restricted area attempts allowed /48 | `Zone Shooting`: `Restricted Area_OPP_FGA`                               |
| Paint (non-RA) FGA share          | Paint (non-RA) attempts allowed /48  | `Zone Shooting`: `In The Paint (Non-RA)_OPP_FGA`                         |
| Mid-range FGA share               | Mid-range attempts allowed /48       | `Zone Shooting`: `Mid-Range_OPP_FGA`                                     |
| Corner 3 FGA share                | Corner 3 attempts allowed /48        | `Zone Shooting`: `Corner 3_OPP_FGA`                                      |
| Above-break 3 FGA share           | Above-break 3 attempts allowed /48   | `Zone Shooting`: `Above the Break 3_OPP_FGA`                             |
| Arc 3 assists share               | Arc 3 assists allowed volume         | `Assists`: `Arc3Assists`, `Arc3Assists_RANK`                             |
| Corner 3 assists share            | Corner 3 assists allowed volume      | `Assists`: `Corner3Assists`, `Corner3Assists_RANK`                       |
| At-rim assists share              | At-rim assists allowed volume        | `Assists`: `AtRimAssists`, `AtRimAssists_RANK`                           |
| Short mid assists share           | Short mid assists allowed volume     | `Assists`: `ShortMidRangeAssists`, `ShortMidRangeAssists_RANK`           |
| Long mid assists share            | Long mid assists allowed volume      | `Assists`: `LongMidRangeAssists`, `LongMidRangeAssists_RANK`             |

## Rank and percentage difference

- Play-type points: use `Playtype Points` values, `_RANK`, and `_vs_avg_pct` from the Season publication.
- Optional play-type PPP and assist locations: use the Team Stats API rank; percentage difference is `(index - 1) × 100`. These values are normalized indices, so do not display them as raw PPP or assists per 48.
- Zones: use the matching FGA field's `_RANK` and `_vs_avg_pct` fields.
- Shot types: sum two- and three-point attempts for each of all 30 teams, rank those totals, and compare with their league mean. Do not combine component ranks or percentage differences.
- Rank 1 always means the lowest value allowed. Positive percentage difference means more volume or higher PPP allowed than the league average. It does not mean the same thing as the player-share threshold.

## Verified ORL examples

| Qualifier     | Opponent measure             | Rank | Difference from average |
| ------------- | ---------------------------- | ---- | ----------------------- |
| Catch & shoot | 24.7746 FGA allowed /48      | 1    | −11.5%                  |
| Spot up       | PPP allowed index 1.003679   | 19   | +0.4%                   |
| Isolation     | PPP allowed index 1.019138   | 21   | +1.9%                   |
| Corner 3      | 8.4357 FGA allowed /48       | 5    | −11.5%                  |
| Arc 3 assists | Assist-volume index 0.886842 | 2    | −11.3%                  |

All 23 slices have corresponding backend measures under this mapping; play-type volume needs wiring into the team-based Target context read. `Misc` exists in the Playtypes API but is not an available player qualifier. The Matchup API already represents possession volume, so this is an endpoint exposure gap, not absent source data; failed requests or genuinely incomplete publications still need an honest unavailable state rather than invented numbers.
