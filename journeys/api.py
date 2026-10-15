"""api.py DB LABEL PATH : GET PATH from the selected backend code (be worktree) against the disposable clone DB, auth bypass, in-process. Saves api/LABEL.json."""
import json, os, re, sys
S='/private/tmp/claude-501/-Users-chrisfu-statsplus/49ebb082-9e16-4048-9949-e6ceb180a9bc/scratchpad'
BE=S+'/be'; OUT=S+'/qa'
db,label,path=sys.argv[1:4]
assert re.fullmatch(r'courtai_qa_[0-9a-f]{16}',db)
pw=json.load(open(os.path.expanduser('~/statsplus-local/qa/config.json')))['password']
for k in list(os.environ):
    if k.startswith(('NBA_','DATABASE','REDIS','FIREBASE')): os.environ.pop(k)
os.environ.update({'PYTHON_DOTENV_DISABLED':'1','FLASK_ENV':'development','FIREBASE_ADMIN_DISABLED':'true','ENABLE_CACHE':'false','ENABLE_LLM_FALLBACK':'false','DFS_BOARD_ENABLED':'false','DFS_ENABLED_PROVIDERS':'','INJURY_REPORT_ENABLED':'false','LOG_LEVEL':'ERROR',
 'DATABASE_URL':f'postgresql://courtai_qa:{pw}@127.0.0.1:55432/{db}'})
sys.path.insert(0,BE); os.chdir(BE)
from app import create_app
c=create_app().test_client()
r=c.get(path)
body=r.get_json()
os.makedirs(OUT+'/api',exist_ok=True)
json.dump({'method':'GET','path':path,'status':r.status_code,'response':body},open(f'{OUT}/api/{label}.json','w'),indent=1)
b=body if isinstance(body,dict) else {}
summ={k:b[k] for k in ('slate_date','previous_game_date','next_game_date','seasons','default_season','error') if k in b}
if 'games' in b: summ['games']=len(b['games'])
print(label,r.status_code,json.dumps(summ))
