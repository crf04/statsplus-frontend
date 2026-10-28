"""Seed one disposable QA database with LeBron James's next game, GSW @ LAL, carrying Dabble lines on the new categories.

usage: seed_lines.py DATABASE   (run from the backend checkout with PYTHONPATH=$PWD and its .venv python)

QA fixture for crf04/statsplus#370 (frontend#403, backend#637). The frozen QA seed holds the 2025-26 schedule only and
no line evidence, so this adds game 0022600001 (GSW @ LAL) two days ahead in 2026-27 and records one complete Dabble
snapshot through ProjectionRecordingService, with decimal per-pick prices as Dabble posts them:

  PTS  21.5  1.8 / 1.952381       (-125 / -105)      existing category, regression
  REB  6.5   1.869159 / 1.952381  (-115 / -105)      existing category, regression
  FTA  4.5   1.666667 / 2.2       (-150 / +120)
  FTM  3.5   2.1 / 1.769231       (+110 / -130)
  FGM  8.5   1.909091 / 1.909091  (-110 / -110)
  FG2M 6.5   2.0 / 1.833333       (+100 / -120)

LeBron 2025-26 Regular Season (60 games, QA seed player_game_logs) over each line: PTS 28, REB 23, FTA 37, FTM 33,
FGM 22, FG2M (FGM - FG3M) 36. Only the disposable database named on the command line is written; rerunning replaces the game.
"""

import json
import os
import re
import sys
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, text

from app.domain.statistics import MatchState, ScoringPeriod, StatisticMatch
from app.providers.dfs import (
    AthleteEvidence,
    CoverageEvidence,
    EventEvidence,
    MarketStatus,
    MarketThreshold,
    MarketVariant,
    NBAMarketQuery,
    PlayerProjectionMarket,
    ProviderSnapshot,
    Selection,
    SnapshotStatus,
    StatisticEvidence,
    TeamEvidence,
)
from app.services.projection_archive import (
    ProjectionArchive,
    ProjectionArchiveReadScope,
    ProjectionRecordingService,
)
from app.services.statistic_catalog import StatisticCatalog
from app.services.stats_freshness_repository import StatsFreshnessRepository

SEASON = "2026-27"
ET = ZoneInfo("America/New_York")
GAME_ID = "0022600001"
AWAY = (1610612744, "Golden State Warriors", "GSW")
HOME = (1610612747, "Los Angeles Lakers", "LAL")
LEBRON = 2544
NAMES = {LEBRON: "LeBron James"}
TEAMS = {LEBRON: HOME[0]}
STATS = {"PTS": "points", "REB": "rebounds", "FTA": "free_throws_attempted", "FTM": "free_throws_made",
         "FGM": "field_goals_made", "FG2M": "two_pointers_made"}


def decimal(over, under):
    return tuple(
        Selection(selection_id=sid, direction=direction, decimal_price=Decimal(price))
        for sid, direction, price in (("o", "over", over), ("u", "under", under))
        if price is not None
    )


# provider -> ((player, market, line, selections), ...)
PICKS = {
    "dabble": ((LEBRON, "PTS", "21.5", decimal("1.8", "1.952381")),
               (LEBRON, "REB", "6.5", decimal("1.869159", "1.952381")),
               (LEBRON, "FTA", "4.5", decimal("1.666667", "2.2")),
               (LEBRON, "FTM", "3.5", decimal("2.1", "1.769231")),
               (LEBRON, "FGM", "8.5", decimal("1.909091", "1.909091")),
               (LEBRON, "FG2M", "6.5", decimal("2.0", "1.833333"))),
}


def snapshot(catalog, provider, picks, retrieved_at):
    markets = []
    # SEED_MARKETS=PTS,REB seeds only those markets, for the base backend whose catalog lacks the new four.
    chosen = os.environ.get("SEED_MARKETS")
    picks = [pick for pick in picks if not chosen or pick[1] in chosen.split(",")]
    for player_id, market, line, selections in picks:
        statistic = catalog.by_id[STATS[market]]
        evidence = StatisticEvidence(provider_id=market.lower(), canonical_id=statistic.id, label=statistic.id,
                                     components=statistic.components)
        team = TeamEvidence(canonical_id=TEAMS[player_id])
        markets.append(
            PlayerProjectionMarket(
                provider=provider,
                market_id=f"qa-{provider}-{statistic.id}-{player_id}",
                athlete=AthleteEvidence(provider_id=f"qa-athlete-{player_id}", canonical_id=player_id,
                                        name=NAMES[player_id], team=team),
                event=EventEvidence(provider_id=f"qa-event-{GAME_ID}", canonical_id=GAME_ID),
                team=team,
                statistic=evidence,
                statistic_match=StatisticMatch(state=MatchState.CANONICAL, evidence=evidence,
                                               scoring_period=ScoringPeriod.FULL_GAME, canonical=statistic,
                                               provider=provider),
                threshold=MarketThreshold(line, "count"),
                status=MarketStatus.AVAILABLE,
                variant=MarketVariant.STANDARD,
                scoring_period=ScoringPeriod.FULL_GAME,
                selections=selections,
            )
        )
    count = len(markets)
    return ProviderSnapshot(
        provider=provider,
        status=SnapshotStatus.COMPLETE,
        markets=tuple(markets),
        coverage=CoverageEvidence(fetched_count=count, eligible_count=count, normalized_count=count,
                                  expected_total=count),
        retrieved_at=retrieved_at,
    )

def main(database):
    if not re.fullmatch(r"courtai_qa_[0-9a-f]{16}", database):
        raise SystemExit("only a disposable courtai_qa_<id> database may be seeded")
    config = json.loads((Path.home() / "statsplus-local/qa/config.json").read_text())
    engine = create_engine(f"postgresql://courtai_qa:{config['password']}@127.0.0.1:55432/{database}")
    catalog = StatisticCatalog.load_default()
    query = NBAMarketQuery(season=SEASON)
    providers = ("dabble",)
    scopes = {p: ProjectionArchiveReadScope(provider=p, query=query) for p in providers}
    recorder = ProjectionRecordingService(ProjectionArchive(engine, catalog), tuple(scopes.values()),
                                          default_scope=scopes["dabble"])

    now = datetime.now(timezone.utc)
    tip = datetime.combine(now.astimezone(ET).date() + timedelta(days=2), time(19, 30), ET)
    with engine.begin() as connection:
        connection.execute(text(
            "TRUNCATE projection_archive_scope_locks, projection_provider_snapshots, projection_provider_polls,"
            " projection_observations, projection_materialization_generations, latest_player_projections,"
            " projection_closing_sets, projection_closing_memberships CASCADE"))
        connection.execute(text("DELETE FROM event_catalog_refreshes WHERE season = :season"), {"season": SEASON})
        connection.execute(text(
            "INSERT INTO event_catalog_refreshes (season, last_attempt_at, last_success_at, event_count)"
            " VALUES (:season, :now, :now, 1)"), {"season": SEASON, "now": now})
        connection.execute(text("DELETE FROM athlete_catalog_freshness WHERE season = :season"), {"season": SEASON})
        connection.execute(text(
            "INSERT INTO athlete_catalog_freshness (season, last_success_at, last_success_row_count, updated_at)"
            " VALUES (:season, :now, 5205, :now)"), {"season": SEASON, "now": now})
        connection.execute(text("DELETE FROM athlete_catalog WHERE season = :season"), {"season": SEASON})
        connection.execute(text(
            "INSERT INTO athlete_catalog (season, player_id, display_name, roster_status, is_active,"
            " is_active_for_season, team_id, team_name, team_abbreviation, published_at)"
            " SELECT :season, player_id, display_name, roster_status, is_active, is_active_for_season,"
            " team_id, team_name, team_abbreviation, :now FROM athlete_catalog WHERE season = '2025-26'"),
            {"season": SEASON, "now": now})
        roster = dict(connection.execute(text(
            "SELECT player_id, team_abbreviation FROM athlete_catalog WHERE season = :season"
            " AND player_id = ANY(:ids)"), {"season": SEASON, "ids": list(NAMES)}).all())
        connection.execute(text("DELETE FROM event_catalog WHERE nba_game_id = :id"), {"id": GAME_ID})
        connection.execute(text(
            "INSERT INTO event_catalog (nba_game_id, season, home_team_id, home_team_name, home_team_tricode,"
            " away_team_id, away_team_name, away_team_tricode, scheduled_at, status_text, status_code,"
            " classification, first_seen_at, last_seen_at) VALUES (:id, :season, :home_id, :home_name,"
            " :home_code, :away_id, :away_name, :away_code, :tip, '7:30 pm ET', 1, 'Regular Season', :now, :now)"),
            {"id": GAME_ID, "season": SEASON, "home_id": HOME[0], "home_name": HOME[1], "home_code": HOME[2],
             "away_id": AWAY[0], "away_name": AWAY[1], "away_code": AWAY[2], "tip": tip, "now": now})
    StatsFreshnessRepository(engine).record_success(now)

    recorded = {}
    for minutes, (provider, picks) in enumerate(PICKS.items(), start=3):
        at = now - timedelta(minutes=minutes)
        recorded[provider] = str(recorder.record_complete_snapshot(snapshot(catalog, provider, picks, at),
                                                                   query=query, accepted_at=at))[:200]

    with engine.begin() as connection:
        stored = [dict(row) for row in connection.execute(text(
            "SELECT provider, canonical_player_id, market_category, line_value, over_price, under_price"
            " FROM latest_player_projections WHERE canonical_game_id = :id ORDER BY provider, canonical_player_id"),
            {"id": GAME_ID}).mappings()]
    print(json.dumps({
        "seeded_at": now.isoformat(), "database": database, "roster_2026_27": roster, "latest_rows": stored,
        "snapshots": recorded,
        "games": [{"number": 1, "game_id": GAME_ID, "matchup": "GSW @ LAL", "slate_date": tip.date().isoformat(),
                   }],
    }, default=str))


if __name__ == "__main__":
    main(sys.argv[1])
