"""Seed one disposable QA database with upcoming 2026-27 games that carry posted lines.

usage: seed_pp.py DATABASE GAME_NUMBER...   (run from the backend checkout with PYTHONPATH=$PWD and its .venv python)

QA fixtures for crf04/statsplus-frontend#222 (per-provider freshness bar). The frozen QA seed holds the
2025-26 schedule only and no projection evidence, so each game number adds one upcoming 2026-27 game to the
disposable database and gives it Dabble (default 15 minute window) and PrizePicks (90 minute window) lines
of chosen ages. Only the disposable database named on the command line is written; running it again for
the same game replaces that game.
"""
import json
import re
import sys
from datetime import datetime, time, timedelta, timezone
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
    SelectionDirection,
    SnapshotStatus,
    StatisticEvidence,
    TeamEvidence,
)
from app.providers.odds_api import BookQuote, OddsEvent
from app.services.odds_dfs_projection import PrizePicksProjectionWriter
from app.services.odds_identity import MappedEvent, ResolvedAthlete
from app.services.projection_archive import (
    ProjectionArchive,
    ProjectionArchiveReadScope,
    ProjectionRecordingService,
)
from app.services.statistic_catalog import StatisticCatalog, StatisticResolver
from app.services.stats_freshness_repository import StatsFreshnessRepository

SEASON = "2026-27"
ET = ZoneInfo("America/New_York")

# Each game: its players, how many days ahead it tips, and how many minutes before the seed the lines were
# read. Game 1: PrizePicks is mid-window (40 of 90) and Dabble two minutes short of its 15, so the open page
# turns only Dabble stale after two minute ticks. Game 2: PrizePicks one minute short of 90, Dabble well inside 15. Game 3: both
# one minute short, for the Slate page, which prints each bar.
GAMES = {
    1: {
        "game_id": "0022600901",
        "away": (1610612747, "Los Angeles Lakers", "LAL"),
        "home": (1610612744, "Golden State Warriors", "GSW"),
        "players": ((2544, "LeBron James", 1610612747, 27.5), (201939, "Stephen Curry", 1610612744, 28.5)),
        "days_ahead": 5,
        "prizepicks_minutes": 40,
        "dabble_minutes": 13,
    },
    2: {
        "game_id": "0022600902",
        "away": (1610612759, "San Antonio Spurs", "SAS"),
        "home": (1610612752, "New York Knicks", "NYK"),
        "players": ((1641705, "Victor Wembanyama", 1610612759, 24.5), (1628973, "Jalen Brunson", 1610612752, 26.5)),
        "days_ahead": 6,
        "prizepicks_minutes": 89,
        "dabble_minutes": 5,
    },
    3: {
        "game_id": "0022600903",
        "away": (1610612750, "Minnesota Timberwolves", "MIN"),
        "home": (1610612743, "Denver Nuggets", "DEN"),
        "players": ((1630162, "Anthony Edwards", 1610612750, 25.5), (203999, "Nikola Jokic", 1610612743, 26.5)),
        "days_ahead": 7,
        "prizepicks_minutes": 89,
        "dabble_minutes": 14,
    },
    # Games 4 to 6 carry PrizePicks lines alone (no other provider has evidence), so the pool's own time is PrizePicks's.
    4: {
        "game_id": "0022600904",
        "away": (1610612738, "Boston Celtics", "BOS"),
        "home": (1610612748, "Miami Heat", "MIA"),
        "players": ((1628369, "Jayson Tatum", 1610612738, 26.5), (1628389, "Bam Adebayo", 1610612748, 18.5)),
        "days_ahead": 8,
        "prizepicks_minutes": 40,
        "dabble_minutes": None,
    },
    5: {
        "game_id": "0022600905",
        "away": (1610612745, "Houston Rockets", "HOU"),
        "home": (1610612756, "Phoenix Suns", "PHX"),
        "players": ((201142, "Kevin Durant", 1610612745, 25.5), (1626164, "Devin Booker", 1610612756, 24.5)),
        "days_ahead": 9,
        "prizepicks_minutes": 89,
        "dabble_minutes": None,
    },
    6: {
        "game_id": "0022600906",
        "away": (1610612749, "Milwaukee Bucks", "MIL"),
        "home": (1610612755, "Philadelphia 76ers", "PHI"),
        "players": ((203507, "Giannis Antetokounmpo", 1610612749, 29.5), (203954, "Joel Embiid", 1610612755, 27.5)),
        "days_ahead": 10,
        "prizepicks_minutes": 89,
        "dabble_minutes": None,
    },
}

PRICED = (Selection(selection_id="higher", direction=SelectionDirection.HIGHER, american_price=-110),)


def dabble_snapshot(catalog, game, retrieved_at):
    statistic = catalog.by_id["points"]
    evidence = StatisticEvidence(
        provider_id="pts", canonical_id=statistic.id, label="Points", components=statistic.components
    )
    markets = []
    for player_id, name, team_id, line in game["players"]:
        team = TeamEvidence(canonical_id=team_id)
        markets.append(
            PlayerProjectionMarket(
                provider="dabble",
                market_id=f"qa-points-{player_id}",
                athlete=AthleteEvidence(
                    provider_id=f"qa-athlete-{player_id}", canonical_id=player_id, name=name, team=team
                ),
                event=EventEvidence(provider_id=f"qa-event-{game['game_id']}", canonical_id=game["game_id"]),
                team=team,
                statistic=evidence,
                statistic_match=StatisticMatch(
                    state=MatchState.CANONICAL,
                    evidence=evidence,
                    scoring_period=ScoringPeriod.FULL_GAME,
                    canonical=statistic,
                    provider="dabble",
                ),
                threshold=MarketThreshold(str(line - 1), "count"),
                status=MarketStatus.AVAILABLE,
                variant=MarketVariant.STANDARD,
                scoring_period=ScoringPeriod.FULL_GAME,
                selections=PRICED,
            )
        )
    count = len(markets)
    return ProviderSnapshot(
        provider="dabble",
        status=SnapshotStatus.COMPLETE,
        markets=tuple(markets),
        coverage=CoverageEvidence(
            fetched_count=count, eligible_count=count, normalized_count=count, expected_total=count
        ),
        retrieved_at=retrieved_at,
    )


def main(database, numbers):
    if not re.fullmatch(r"courtai_qa_[0-9a-f]{16}", database):
        raise SystemExit("only a disposable courtai_qa_<id> database may be seeded")
    config = json.loads((Path.home() / "statsplus-local/qa/config.json").read_text())
    engine = create_engine(f"postgresql://courtai_qa:{config['password']}@127.0.0.1:55432/{database}")
    catalog = StatisticCatalog.load_default()
    query = NBAMarketQuery(season=SEASON)
    scopes = tuple(ProjectionArchiveReadScope(provider=p, query=query) for p in ("dabble", "prizepicks"))
    recorder = ProjectionRecordingService(ProjectionArchive(engine, catalog), scopes, default_scope=scopes[1])
    writer = PrizePicksProjectionWriter(recorder, query=query, statistics=StatisticResolver(catalog))

    now = datetime.now(timezone.utc)
    today_et = now.astimezone(ET).date()
    summary = {"seeded_at": now.isoformat(), "database": database, "games": []}
    with engine.begin() as connection:
        # The archive orders each provider's polls by when they were read, and a poll older than the provider's
        # newest one is recorded but not promoted. Every seed run therefore starts from an empty archive, so the
        # games of one QA session can carry lines of any age without superseding one another.
        connection.execute(
            text(
                "TRUNCATE projection_archive_scope_locks, projection_provider_snapshots, projection_provider_polls,"
                " projection_observations, projection_materialization_generations, latest_player_projections,"
                " projection_closing_sets, projection_closing_memberships CASCADE"
            )
        )
        # The 2026-27 schedule and roster are published fresh, so the header's other warnings stay out of the proofs.
        connection.execute(text("DELETE FROM event_catalog_refreshes WHERE season = :season"), {"season": SEASON})
        connection.execute(
            text(
                "INSERT INTO event_catalog_refreshes (season, last_attempt_at, last_success_at, event_count)"
                " VALUES (:season, :now, :now, 3)"
            ),
            {"season": SEASON, "now": now},
        )
        connection.execute(text("DELETE FROM athlete_catalog_freshness WHERE season = :season"), {"season": SEASON})
        connection.execute(
            text(
                "INSERT INTO athlete_catalog_freshness (season, last_success_at, last_success_row_count, updated_at)"
                " VALUES (:season, :now, 5205, :now)"
            ),
            {"season": SEASON, "now": now},
        )
        connection.execute(text("DELETE FROM athlete_catalog WHERE season = :season"), {"season": SEASON})
        connection.execute(
            text(
                "INSERT INTO athlete_catalog (season, player_id, display_name, roster_status, is_active,"
                " is_active_for_season, team_id, team_name, team_abbreviation, published_at)"
                " SELECT :season, player_id, display_name, roster_status, is_active, is_active_for_season,"
                " team_id, team_name, team_abbreviation, :now FROM athlete_catalog WHERE season = '2025-26'"
            ),
            {"season": SEASON, "now": now},
        )
        for number in numbers:
            game = GAMES[number]
            away_id, away_name, away_code = game["away"]
            home_id, home_name, home_code = game["home"]
            tip = datetime.combine(today_et + timedelta(days=game["days_ahead"]), time(19, 30), ET)
            connection.execute(text("DELETE FROM event_catalog WHERE nba_game_id = :id"), {"id": game["game_id"]})
            connection.execute(
                text(
                    "INSERT INTO event_catalog (nba_game_id, season, home_team_id, home_team_name, home_team_tricode,"
                    " away_team_id, away_team_name, away_team_tricode, scheduled_at, status_text, status_code,"
                    " classification, first_seen_at, last_seen_at) VALUES (:id, :season, :home_id, :home_name,"
                    " :home_code, :away_id, :away_name, :away_code, :tip, '7:30 pm ET', 1, 'Regular Season', :now, :now)"
                ),
                {
                    "id": game["game_id"], "season": SEASON, "home_id": home_id, "home_name": home_name,
                    "home_code": home_code, "away_id": away_id, "away_name": away_name, "away_code": away_code,
                    "tip": tip, "now": now,
                },
            )
            game["slate_date"] = tip.date().isoformat()
            game["tip"] = tip

    StatsFreshnessRepository(engine).record_success(now)
    for number in numbers:
        game = GAMES[number]
        away_id, away_name, _ = game["away"]
        home_id, home_name, _ = game["home"]
        if game["dabble_minutes"] is not None:
            dabble_at = now - timedelta(minutes=game["dabble_minutes"])
            recorder.record_complete_snapshot(
                dabble_snapshot(catalog, game, dabble_at), query=query, accepted_at=dabble_at
            )
        pp_at = now - timedelta(minutes=game["prizepicks_minutes"])
        quotes = []
        athletes = {}
        for player_id, name, team_id, line in game["players"]:
            quotes.append(BookQuote("prizepicks", "player_points", "PTS", name, line, -119, -119, None))
            quotes.append(BookQuote("prizepicks", "player_rebounds", "REB", name, 7.5, -119, -119, None))
            athletes[name] = ResolvedAthlete(player_id, team_id, name)
        recorded = writer.record(
            MappedEvent(
                event=OddsEvent(f"qa-odds-{game['game_id']}", game["tip"], home_name, away_name),
                game_id=game["game_id"],
                team_ids=(home_id, away_id),
                scheduled_at=game["tip"],
            ),
            quotes,
            athletes,
            retrieved_at=pp_at,
            accepted_at=pp_at,
            poll_started_at=pp_at,
        )
        summary["games"].append(
            {
                "number": number,
                "game_id": game["game_id"],
                "matchup": f"{away_name} @ {home_name}",
                "slate_date": game["slate_date"],
                "prizepicks_minutes_old_at_seed": game["prizepicks_minutes"],
                "dabble_minutes_old_at_seed": game["dabble_minutes"],
                "prizepicks_lines_recorded": recorded,
            }
        )
    print(json.dumps(summary))


if __name__ == "__main__":
    main(sys.argv[1], [int(n) for n in sys.argv[2:]])
