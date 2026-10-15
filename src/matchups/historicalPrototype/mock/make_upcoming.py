"""PROTOTYPE — throwaway. Build the upcoming-game twin of the captured CLE @ ORL
game: scheduled status, current-mode experience, Player Pool participants with
posted markets, no focal line. Scores, diets and the Defense Sheet stay real.

Lines are SAMPLE values (the live contract carries no line numbers today, only
which books post which market): each is his average over the captured games vs
this opponent, scaled so PTS matches his PPG, rounded to the nearest .5 line.
Rerunnable: `python3 make_upcoming.py` from this directory.
"""
import glob
import json
import re

FULL = ["3PM", "AST", "BLK", "FGA", "PA", "PR", "PRA", "PTS", "RA", "REB", "STL", "TOV"]
MID = ["3PM", "AST", "PA", "PR", "PRA", "PTS", "RA", "REB"]
LOW = ["PRA", "PTS", "REB"]
UNDERDOG = {"PTS", "REB", "AST", "3PM", "PRA"}
ORDER = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TOV", "FGA", "PR", "PA", "RA", "PRA"]

m = json.load(open("matchup.json"))
from datetime import datetime, timedelta
start = datetime.fromisoformat(m["game"]["scheduled_at"]) - timedelta(hours=4)  # EDT on 2026-03-11
m["game"]["status"] = {"label": start.strftime("%-I:%M %p ET"), "state": "scheduled"}
m["experience"] = {
    "mode": "current",
    "player_source": "player_pool",
    "sections": {
        "schedule": {"status": "available", "source": "event_catalog", "context": "current_season_catalog", "unavailable_reason": None, "collected_at": "2026-03-11T15:00:00+00:00"},
        "participants": {"status": "available", "source": "player_pool", "context": "posted_markets", "unavailable_reason": None},
        "season_defense": {"status": "available", "source": "team_matchup_publication", "context": "pregame", "unavailable_reason": None},
        "last_15_defense": {"status": "unavailable", "source": None, "context": None, "unavailable_reason": "no_point_in_time_snapshot"},
        "injuries": {"status": "unavailable", "source": None, "context": None, "unavailable_reason": "no_snapshot"},
    },
}
f = m["freshness"]
f["pool"] = {"status": "fresh", "retrieved_at": "2026-03-11T22:40:00+00:00", "providers": {
    "prizepicks": {"status": "fresh", "retrieved_at": "2026-03-11T22:40:00+00:00"},
    "underdog": {"status": "fresh", "retrieved_at": "2026-03-11T22:38:00+00:00"}}}
f["stats"] = {"status": "fresh", "retrieved_at": "2026-03-11T14:00:00+00:00"}

lines = {}
players = []
counts = {}
for p in m["players"]:
    ppg = p["season_scoring"] or 0
    if ppg < 5:
        continue
    posted = FULL if ppg >= 15 else MID if ppg >= 8 else LOW
    sel = json.load(open(f"selection-{p['canonical_id']}.json"))
    rows = [r["stats"] for r in sel["h2h"]["rows"]] + [p["focal_game_line"]["stats"]]
    line = {}
    h2h_pts = sum(r["PTS"] for r in rows) / len(rows) or 1
    # A handful of games vs one opponent is noisy; keep the scale near 1.
    scale = min(1.4, max(0.7, ppg / h2h_pts)) if h2h_pts >= 5 else 1
    for k in posted:
        avg = ppg if k == "PTS" else sum(r[k] for r in rows) / len(rows) * scale
        line[k] = max(0.5, round(avg - 0.5) + 0.5)
    for combo, parts in {"PR": "PTS REB", "PA": "PTS AST", "RA": "REB AST", "PRA": "PTS REB AST"}.items():
        if combo in posted and all(x in line for x in parts.split()):
            line[combo] = sum(line[x] for x in parts.split()) - 0.5 * (len(parts.split()) - 1)
    lines[str(p["canonical_id"])] = {k: line[k] for k in ORDER if k in line}
    p.update(
        player_source="player_pool",
        posted_markets=posted,
        stat_categories=posted,
        focal_game_line=None,
        scores={k: p["scores"][k] for k in posted},
        provenance={"prizepicks": posted, **({"underdog": [k for k in posted if k in UNDERDOG]} if ppg >= 10 else {})},
    )
    # A current-mode window never shows components under a withheld Blend.
    for market, windows in p["scores"].items():
        for window in windows.values():
            if window.get("blend") is None and market not in ("TOV", "STL", "BLK", "STKS"):
                window["components"] = {}
    counts[p["team_id"]] = counts.get(p["team_id"], 0) + 1
    players.append(p)
    sel["experience"] = {"mode": "current", "player_source": "player_pool", "focal_game": None,
                         "samples": {"context": "season_to_date", "excludes_focal_game": False},
                         "baseline": {"context": "season_to_date", "hindsight": False}}
    json.dump(sel, open(f"selection-upcoming-{p['canonical_id']}.json", "w"))
m["players"] = players
for side in ("away_team", "home_team"):
    m["game"][side]["targetable_player_count"] = counts.get(m["game"][side]["team_id"], 0)
json.dump(m, open("matchup-upcoming.json", "w"))
json.dump(lines, open("sample-lines.json", "w"), indent=1)
print(len(players), "pool players;", json.dumps(lines)[:300])
