# Verification plan: crf04/statsplus#274 Game Logs posted-line picker (frontend#284 2882587, backend origin/master 92f8985 with be#506)

QA: pinned helper copy (helper-pin.diff: PROJECTION_ARCHIVE_READ_ENABLED + ODDS_API_ENABLED in the QA backend env;
saves /api/games/game_logs bodies to responses/). seed_lines.py writes LeBron James's next game (GSW @ LAL, 2 days
ahead, 2026-27) into the disposable DB only: provider snapshots via ProjectionRecordingService / PrizePicks writer,
book quotes via SportsbookQuoteStore. PTS: PrizePicks 21.5 (no per-pick price), Dabble 21.5, Novig 20.5, Underdog 20.5,
DraftKings 20.5, FanDuel 20.5, BetRivers 22.5. REB: Novig 6.5, Underdog 6.5, DraftKings 6.5, FanDuel 7.5.
LeBron 2025-26 PTS over 20.5 / 22.5 / 25: 31 / 24 / 15 of 60; REB over 6.5: 23 of 60.

| Behavior | Regression it would catch | Trigger | Observable outcome |
| --- | --- | --- | --- |
| Picker lists every provider and book | A source dropped, prices missing, price shown for a no-price provider | Open /?player_name=LeBron+James | group "Posted Lines:" with 7 chips, names + Over/Under; PrizePicks shows its line alone |
| Default = source `lines` names (majority) | PrizePicks-first default (21.5) or no chip pressed | same | Line Value 20.5, Novig chip pressed, Hit Rate 31/60 |
| Choosing BetRivers | Line Value, chart line, label or counts not following the chip | click BetRivers chip | BetRivers pressed, Novig not, Line Value 22.5, Hit Rate 24/60, chart label "BetRivers 22.5 / LAL vs GSW · Thu, Oct 22" (PNG) |
| Typed Line Value overrides | A chip stays pressed or label keeps the source | fill Line Value 25 | no chip pressed, Hit Rate 15/60, chart label "Line: 25" (PNG) |
| Line Type change resets to its default | Typed 25 survives, or PTS chips stay | Line Type -> REB | Line Value 6.5, Novig 6.5 pressed, FanDuel 7.5 listed, BetRivers gone, Hit Rate 23/60 |
| Phone interaction | Chips unusable / overflow at 390 px | phone viewport, reopen, click BetRivers | 22.5, 24/60, assert-layout passes |

Production (read-only): a real player on today's or the next slate; query the production API for sources that disagree;
Game Logs picker lists real sources; default chip pressed; choosing another chip moves Line Value; desktop + phone.
