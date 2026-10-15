"""drive.py NAME JOURNEY OUTDIR: run control-statsplus (QA) over a pipe, one command per result line; _hook lines run locally."""
import json, os, subprocess, sys
S='/private/tmp/claude-501/-Users-chrisfu-statsplus/49ebb082-9e16-4048-9949-e6ceb180a9bc/scratchpad'
Q=S+'/qa'; PY=S+'/be/.venv/bin/python'
HELPER='/Users/chrisfu/statsplus/.agents/skills/verify-statsplus/scripts/control-statsplus.mjs'
name,journey,out=sys.argv[1:4]
p=subprocess.Popen(['node',HELPER,'--frontend',S+'/fe','--backend',S+'/be','--out',out],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=open(f'{Q}/{name}.err','w'),text=True,bufsize=1)
o=open(f'{Q}/{name}.out','w')
def read():
    l=p.stdout.readline(); o.write(l); o.flush(); return json.loads(l) if l.strip() else {'ok':False,'eof':True}
launch=read(); print('launch',json.dumps(launch)[:900])
if not launch.get('ready'): sys.exit(1)
db=(launch.get('qa') or {}).get('database') or json.dumps(launch)
import re
m=re.search(r'courtai_qa_[0-9a-f]{16}',json.dumps(launch)); db=m.group(0)
ex=open(f'{Q}/{name}.executed.jsonl','w'); cmd={}
for raw in open(journey):
    if not raw.strip(): continue
    cmd=json.loads(raw)
    if '_hook' in cmd:
        k=cmd['_hook']
        if k=='api': r=subprocess.run([PY,Q+'/api.py',db,cmd['label'],cmd['path']],capture_output=True,text=True)
        elif k=='seed': r=subprocess.run([PY,Q+'/seed.py',db],cwd=S+'/be',capture_output=True,text=True)
        elif k=='sql':
            cfg=json.load(open(os.path.expanduser('~/statsplus-local/qa/config.json')))
            r=subprocess.run(['psql','-h','127.0.0.1','-p','55432','-U','courtai_qa','-d',db,'-At','-c',cmd['sql']],env={**os.environ,'PGPASSWORD':cfg['password']},capture_output=True,text=True)
        print(k,r.returncode,r.stdout.strip()[:1500],r.stderr.strip()[-800:]); continue
    p.stdin.write(json.dumps(cmd,ensure_ascii=False)+'\n'); p.stdin.flush(); ex.write(json.dumps(cmd,ensure_ascii=False)+'\n'); ex.flush()
    res=read()
    if not res.get('ok'):
        print('FAILED',json.dumps(cmd),json.dumps(res)[:1000]); break
    if cmd['action'] in ('proof','snapshot') or cmd.get('_show'): print(cmd['action'],json.dumps(res)[:400])
if p.poll() is None and cmd.get('action')!='cleanup':
    p.stdin.write('{"action":"cleanup"}\n'); p.stdin.flush(); ex.write('{"action":"cleanup"}\n'); read()
p.stdin.close(); p.wait(timeout=180); ex.close()
print('done',p.returncode)
