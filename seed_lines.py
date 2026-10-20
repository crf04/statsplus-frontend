"""Seed one disposable QA database with LeBron James's next game, LAL vs GSW, whose sources disagree.

usage: seed_lines.py DATABASE   (run from the backend checkout with PYTHONPATH=$PWD and its .venv python)

QA fixture for crf04/statsplus#274 (Game Logs posted-line source picker, frontend#284). The frozen QA seed holds
the 2025-26 schedule only and no line evidence, so this adds game 0022600001 (GSW @ LAL) two days ahead in 2026-27.
Provider snapshots go through ProjectionRecordingService and sportsbook quotes through SportsbookQuoteStore.

  PTS  PrizePicks 21.5 (no per-pick price), Dabble 21.5 (-122 even), Novig 20.5 (decimal 1.909091/1.952381 = -110/-105),
       Underdog 20.5 -112/-112, DraftKings 20.5 -115/-105, FanDuel 20.5 -110/-110, BetRivers 22.5 -105/-125.
       Majority 20.5 (4 of 7), first source posting it Novig; the old PrizePicks-first rule gives PrizePicks 21.5.
  REB  Novig 6.5 (1.952381/1.869159 = -105/-115), Underdog 6.5 -120/-105, DraftKings 6.5 -125/+100,
       FanDuel 7.5 -105/-120. Majority 6.5, default Novig.
Only the disposable database named on the command line is written; rerunning replaces the game.
"""

import json
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
from app.providers.odds_api import BookQuote, OddsEvent
from app.services.odds_dfs_projection import PrizePicksProjectionWriter
from app.services.odds_identity import MappedEvent, ResolvedAthlete
from app.services.projection_archive import (
    ProjectionArchive,
    ProjectionArchiveReadScope,
    ProjectionRecordingService,
)
from app.services.sportsbook_quotes import ResolvedQuote, SportsbookQuoteStore
from app.services.statistic_catalog import StatisticCatalog, StatisticResolver
from app.services.stats_freshness_repository import StatsFreshnessRepository

SEASON = "2026-27"
ET = ZoneInfo("America/New_York")
GAME_ID = "0022600001"
AWAY = (1610612744, "Golden State Warriors", "GSW")
HOME = (1610612747, "Los Angeles Lakers", "LAL")
LEBRON = 2544
NAMES = {LEBRON: "LeBron James"}
TEAMS = {LEBRON: HOME[0]}
STATS = {"PTS": "points", "REB": "rebounds"}


def american(over, under):
    return tuple(
        Selection(selection_id=sid, direction=direction, american_price=price)
        for sid, direction, price in (("h", "Higher", over), ("l", "Lower", under))
        if price is not None
    )


def decimal(over, under):
    return tuple(
        Selection(selection_id=sid, direction=direction, decimal_price=Decimal(price))
        for sid, direction, price in (("o", "over", over), ("u", "under", under))
        if price is not None
    )


# provider -> ((player, market, line, selections), ...)
PICKS = {
    "dabble": ((LEBRON, "PTS", "21.5", american(-105, -105)),),
    "novig": ((LEBRON, "PTS", "20.5", decimal("1.909091", "1.952381")),
              (LEBRON, "REB", "6.5", decimal("1.952381", "1.869159"))),
    "underdog": ((LEBRON, "PTS", "20.5", american(-112, -112)),
                 (LEBRON, "REB", "6.5", american(-120, -105))),
}
# (player, category, book, line, over, under, minutes before the seed)
BOOK_QUOTES = (
    (LEBRON, "PTS", "draftkings", 20.5, -115, -105, 6),
    (LEBRON, "PTS", "fanduel", 20.5, -110, -110, 7),
    (LEBRON, "PTS", "betrivers", 22.5, -105, -125, 8),
    (LEBRON, "REB", "draftkings", 6.5, -125, 100, 6),
    (LEBRON, "REB", "fanduel", 7.5, -105, -120, 7),
)


def snapshot(catalog, provider, picks, retrieved_at):
    markets = []
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
    providers = ("prizepicks", "dabble", "underdog", "novig", "polymarket")
    scopes = {p: ProjectionArchiveReadScope(provider=p, query=query) for p in providers}
    recorder = ProjectionRecordingService(ProjectionArchive(engine, catalog), tuple(scopes.values()),
                                          default_scope=scopes["prizepicks"])

    writer = PrizePicksProjectionWriter(recorder, query=query, statistics=StatisticResolver(catalog))
    now = datetime.now(timezone.utc)
    tip = datetime.combine(now.astimezone(ET).date() + timedelta(days=2), time(19, 30), ET)
    with engine.begin() as connection:
        connection.execute(text(
            "TRUNCATE projection_archive_scope_locks, projection_provider_snapshots, projection_provider_polls,"
            " projection_observations, projection_materialization_generations, latest_player_projections,"
            " projection_closing_sets, projection_closing_memberships CASCADE"))
        connection.execute(text("DELETE FROM sportsbook_prop_latest WHERE canonical_game_id = :id"), {"id": GAME_ID})
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

    pp_at = now - timedelta(minutes=10)
    pp_recorded = writer.record(
        MappedEvent(event=OddsEvent(f"qa-odds-{GAME_ID}", tip, HOME[1], AWAY[1]), game_id=GAME_ID,
                    team_ids=(HOME[0], AWAY[0]), scheduled_at=tip),
        [BookQuote("prizepicks", "player_points", "PTS", NAMES[LEBRON], 21.5, -119, -119, None)],
        {NAMES[LEBRON]: ResolvedAthlete(LEBRON, TEAMS[LEBRON], NAMES[LEBRON])},
        retrieved_at=pp_at, accepted_at=pp_at, poll_started_at=pp_at)

    recorded = {}
    for minutes, (provider, picks) in enumerate(PICKS.items(), start=3):
        at = now - timedelta(minutes=minutes)
        recorded[provider] = str(recorder.record_complete_snapshot(snapshot(catalog, provider, picks, at),
                                                                   query=query, accepted_at=at))[:200]

    write = SportsbookQuoteStore(engine).record_poll(
        odds_event_id=f"qa-books-{GAME_ID}", game_id=GAME_ID, started_at=now - timedelta(minutes=1),
        completed_at=now - timedelta(minutes=1), cost=0, remaining=None, is_closing=False, commence_time=tip,
        quotes=[ResolvedQuote(player, category, book, line, over, under, now - timedelta(minutes=minutes))
                for player, category, book, line, over, under, minutes in BOOK_QUOTES])
    with engine.begin() as connection:
        stored = [dict(row) for row in connection.execute(text(
            "SELECT provider, canonical_player_id, market_category, line_value, over_price, under_price"
            " FROM latest_player_projections WHERE canonical_game_id = :id ORDER BY provider, canonical_player_id"),
            {"id": GAME_ID}).mappings()]
    print(json.dumps({
        "seeded_at": now.isoformat(), "database": database, "roster_2026_27": roster, "latest_rows": stored,
        "snapshots": recorded,
        "games": [{"number": 1, "game_id": GAME_ID, "matchup": "GSW @ LAL", "slate_date": tip.date().isoformat(),
                   "prizepicks_lines_recorded": pp_recorded, "book_latest_rows": write.latest_rows}],
    }, default=str))


if __name__ == "__main__":
    main(sys.argv[1])
