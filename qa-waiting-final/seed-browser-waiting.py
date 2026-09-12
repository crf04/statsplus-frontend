"""Seed a controlled waiting-read scenario ONLY in a disposable QA database.

This proves browser transport/rendering, not collection or league readiness.
Collection/release is independently verified by catalog-bound backend tests.
Sports rows are copied QA data; production and the frozen QA seed are untouched.
"""
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import psycopg2

name = sys.argv[1]
if not re.fullmatch(r'courtai_qa_[0-9a-f]{16}', name):
    raise SystemExit('Refusing a non-disposable QA database')
config = json.loads((Path.home() / 'statsplus-local/qa/config.json').read_text())
now = datetime.now(timezone.utc)
with psycopg2.connect(host='127.0.0.1', port=55432, dbname=name,
                      user='courtai_qa', password=config['password']) as db:
    with db.cursor() as cur:
        cur.execute("SELECT current_database()")
        assert cur.fetchone()[0] == name
        cur.execute("""UPDATE event_catalog SET scheduled_at=%s, status_code=1,
            status_text='Scheduled', first_observed_started_at=NULL
            WHERE nba_game_id='0022501174'""", (now + timedelta(days=1),))
        assert cur.rowcount == 1
        cur.execute("""DELETE FROM team_matchup_surface_observations
            WHERE season='2025-26' AND window_games=15 AND as_of_date=%s""", (now.date(),))
        cur.execute("""INSERT INTO stats_refreshes (surface,last_success_at)
            VALUES ('stats_tables',%s) ON CONFLICT (surface)
            DO UPDATE SET last_success_at=EXCLUDED.last_success_at""", (now,))
        for surface in ('traditional', 'assist_locations', 'shot_types', 'shot_zones', 'play_types'):
            reason = 'provider_window_unsupported' if surface == 'play_types' else 'insufficient_governed_games'
            status = 'unavailable' if surface == 'play_types' else 'missing'
            cur.execute("""INSERT INTO team_matchup_surface_observations
                (season,as_of_date,window_kind,window_games,surface,status,unavailable_reason,
                 retrieved_at,game_ids,source_observation_ids,cutoff,recomposition_reason)
                VALUES ('2025-26',%s,'rolling_games',15,%s,%s,%s,%s,'[]','[]',%s,'qa_browser_waiting_scenario')""",
                (now.date(),surface,status,reason,now,now))
print(json.dumps({'database':name,'scenario':'controlled stored waiting state',
                  'game':'0022501174','as_of':str(now.date()),'production_changed':False}))
