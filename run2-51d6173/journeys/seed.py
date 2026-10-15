"""seed.py DB (cwd = be worktree): QA-only. In ONE disposable clone, publish a synthetic 2026-27 player_game_logs
(LeBron's five latest 2025-26 rows relabelled to 2026-27) through the real PublicationService write path and move the pointer,
so 2025-26 becomes a retained publication. Never touches anything but the named courtai_qa_<hex> clone."""
import json, os, re, sys
from datetime import date, datetime, timedelta, timezone
db=sys.argv[1]; assert re.fullmatch(r'courtai_qa_[0-9a-f]{16}',db),'disposable QA clone only'
pw=json.load(open(os.path.expanduser('~/statsplus-local/qa/config.json')))['password']
for k in list(os.environ):
    if k.startswith(('NBA_','DATABASE','REDIS','FIREBASE')): os.environ.pop(k)
os.environ['PYTHON_DOTENV_DISABLED']='1'
sys.path.insert(0,os.getcwd())
from sqlalchemy import create_engine,text
from sqlalchemy.orm import Session
from app.domain.publication_integrity import canonical_publication_json
from app.services.collection_control import PublicationService
from tests.support.season_rollover import cut_over_if_held
engine=create_engine(f'postgresql://courtai_qa:{pw}@127.0.0.1:55432/{db}')
with engine.connect() as c:
    rows=[json.loads(r[0]) for r in c.execute(text("""select row_payload from publication_player_game_logs p
      join publication_pointers ptr on ptr.active_publication_id=p.publication_id
      where ptr.stream_key='player_game_logs' and row_payload like '%LeBron James%' order by game_date desc limit 5"""))]
assert len(rows)==5, len(rows)
new=[]
for i,r in enumerate(sorted(rows,key=lambda r:r['game_date'])):
    r=dict(r); r['season']='2026-27'; r['game_id']=f'002260{i+1:04d}'; r['game_date']=(date(2026,10,22)+timedelta(days=2*i)).isoformat(); new.append(r)
now=datetime.now(timezone.utc)
svc=PublicationService(engine,clock=lambda:now)
payload={'rows':new}
info={}
with Session(engine) as s, s.begin():
    v=svc._compose_active_in_session(s,stream_key='player_game_logs',season='2026-27',cutoff=now,encoded=canonical_publication_json(payload),payload=payload,expected_fence=None,reason=None,provenance_ids=set(),now=now,derive_expected_fence_from_lock=True)
    cut_over_if_held(svc,v,session=s)
    info={'composed':str(v.publication_id),'status':v.status,'rows':len(new),'first_game_id':new[0]['game_id'],'first_date':new[0]['game_date']}
print(json.dumps(info))
