# Verification plan: rerun at frontend#284 86dec93 (selection model in src/lineSelection.js)

Extends ../verification-plan.md (2882587). Same QA seed (seed_lines.py: LeBron James, GSW @ LAL, 2026-27; PTS PrizePicks 21.5,
Dabble 21.5, Novig/Underdog/DraftKings/FanDuel 20.5, BetRivers 22.5; REB Novig/Underdog/DraftKings 6.5, FanDuel 7.5).
QA backend: throwaway detached worktree at statsplus-backend origin/master a7da117 (includes be#506 majority default).
drive.py gains a `capture` hook: after switching to a player with no posted line, it reads the game_logs body the switch
fetched and asserts Line Value equals that body's season_averages[0].PTS to one decimal.

| Behavior | Regression it would catch | Trigger | Observable outcome |
| --- | --- | --- | --- |
| Everything in the 2882587 plan | as before | as before | as before |
| A chosen source resets on player switch | BetRivers (22.5) carried to the next player or back to LeBron | choose BetRivers, Player -> Austin Reaves, Player -> LeBron James (search box, no reload) | Reaves: Line Value = his season average (23.3), no Posted Lines group; LeBron: 20.5, Novig pressed, BetRivers not, 31/60 |
| A typed value resets on Line Type round trip | Typed 25 survives PTS -> REB -> PTS | type 25, Line Type REB, Line Type PTS | REB 6.5 Novig; PTS 20.5, Novig pressed, BetRivers not, 31/60 |
| Phone player switch | as above, at 390 px | phone: choose BetRivers, Reaves, LeBron | as above |

Production (read-only, local frontend vs production Railway): Jayson Tatum (BOS @ DET, 2026-10-20) as before, plus choose
Underdog 24.5 -> Player Jaylen Brown (Dabble 20.5 default, 62/71) -> Player Jayson Tatum (Dabble 26.5, Underdog not
pressed, 1/16), desktop and phone; typed 20 -> REB -> PTS resets to Dabble 26.5.
Expected production values come from a read-only exploration run (explore-prod-run/responses) taken minutes before.
