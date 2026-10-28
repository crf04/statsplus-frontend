# Verification plan: crf04/statsplus#370 AC1, AC2, AC3, AC5 (frontend#403 898f3e4, backend#637 10425d6)

QA uses a pinned helper copy (helper-pin.diff: PROJECTION_ARCHIVE_READ_ENABLED=true in the QA backend env; matchup and
game_logs response bodies saved to responses/). seed_lines.py writes LeBron James's next game (GSW @ LAL, 2 days ahead,
2026-27) into the disposable DB only, with one complete Dabble snapshot (decimal per-pick prices):
PTS 21.5 (-125/-105), REB 6.5 (-115/-105), FTA 4.5 (-150/+120), FTM 3.5 (+110/-130), FGM 8.5 (-110/-110), FG2M 6.5 (+100/-120).
LeBron 2025-26 RS over each line, from QA seed player_game_logs: PTS 28, REB 23, FTA 37, FTM 33, FGM 22, FG2M 36 of 60.

| AC | Behavior | Regression it would catch | Trigger | Observable outcome |
| --- | --- | --- | --- | --- |
| AC1 | Matchup decodes the new codes | Decoder throws on FTA/FTM/FGM/FG2M, page fails | open /matchups/0022600001 | "What LAL allows" renders, no alert |
| AC1 | Full labels on market tabs | Codes shown bare, tabs missing | GSW defense | Market buttons named Free Throws Attempted / Free Throws Made / Field Goals Made / Two-Pointers Made |
| AC1 | Dabble line + prices per new category | Wrong line, prices dropped or swapped | click each new tab | rail group "Best Over X at Dabble, best Under Y at Dabble, line L" for all four; card Apps table per category |
| AC1 | No Matchup Score for new categories | Unscored categories get a Score Matrix row or the decoder rejects them | Open selection card | Score Matrix rowheaders PTS and REB only; no FTA/FTM/FGM/FG2M rows |
| AC2 | Game Logs default = posted Dabble line | Line Value empty or not Dabble, wrong price | Line Type FTM/FTA/FG2M/FGM | Line Value = Dabble line, Dabble chip pressed, hit counts 33/37/36/22 of 60 |
| AC2 | FG2M = FGM - FG3M per game | FG2M read from wrong column | FG2M Line Type; response body | every game_logs row FG2M == FGM - FG3M; 2 games checked in UI |
| AC3 | Target on FG2M and FTA, backtested | Catalogue missing FG2M, backtest 4xx/5xx | New Target: Season average FG2M >= 5 (BOS), FTA >= 4 (MIA) | POST /api/user/targets 201, Lab "Backtest up to date." with FG2M/FTA summary, list GET /targets/<id>/backtest 200 |
| AC5 | PTS/REB unchanged | Score, line or Defense Sheet changes for existing markets | Same journey on base backend 4cf69d3 (merge base), PTS/REB seeded only | Matchup response teams/scores/defense rows and PTS/REB player fields equal; Score Matrix, rail and hit counts equal |

Out of scope: AC4 (MCP), AC6 (production). Phone: Matchup FTA tab + card, Game Logs FG2M, Targets list + Lab.
