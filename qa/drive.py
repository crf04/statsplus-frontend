"""drive.py JOURNEY OUT_DIR [extra helper args...]

Runs the pinned control-statsplus helper over a pipe, one command per result line. Lines with "_hook" run
locally between browser steps and are not sent to the helper:
  {"_hook":"seed","games":[1]}      seed_pp.py against the session's disposable database (fixture ages start now)
  {"_hook":"mark","name":"m"}       note the moment the page under test mounted
  {"_hook":"until","name":"m","seconds":150}   wait until 150 s after that mark, so its minute clock has ticked twice
Placeholders {{DATE1}}, {{DATE2}}, {{DATE3}}, {{GAME1}}... in later commands take the seeded slate date / game id.
Helper stdout (results) goes to OUT_DIR.out and the hook log to OUT_DIR.hooks.jsonl.
"""
import json
import os
import subprocess
import sys
import time

EV = os.path.dirname(os.path.abspath(__file__))
FRONTEND = '/Users/chrisfu/.t3/worktrees/statsplus-frontend-215'
BACKEND = '/Users/chrisfu/.t3/worktrees/statsplus-backend-qa-215'
COORD = '/Users/chrisfu/.t3/worktrees/statsplus/t3code-62b14da4'
journey, out_dir, *extra = sys.argv[1:]
node = '/opt/homebrew/bin/node'
env = {**os.environ, 'PATH': '/opt/homebrew/bin:' + os.environ['PATH']}
proc = subprocess.Popen(
    [node, f'{EV}/helper-pin/control-statsplus.mjs', '--frontend', FRONTEND, '--backend', BACKEND,
     '--coordination', COORD, '--out', out_dir, *extra],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=open(out_dir + '.err', 'w'), text=True, bufsize=1, env=env)
results = open(out_dir + '.out', 'w')
hooks = open(out_dir + '.hooks.jsonl', 'w')
subs = {}
marks = {}


def read():
    line = proc.stdout.readline()
    results.write(line)
    results.flush()
    return json.loads(line) if line.strip() else {'ok': False, 'eof': True}


launch = read()
print('launch', json.dumps({k: launch.get(k) for k in ('ok', 'ready', 'api', 'frontend', 'qa')})[:500], flush=True)
if not launch.get('ready'):
    sys.exit(1)
database = (launch.get('qa') or {}).get('database')


def substitute(text):
    for key, value in subs.items():
        text = text.replace('{{' + key + '}}', value)
    return text


def hook(spec):
    kind = spec['_hook']
    if kind == 'seed':
        result = subprocess.run(
            [f'{BACKEND}/.venv/bin/python', f'{EV}/seed_pp.py', database, *map(str, spec['games'])],
            cwd=BACKEND, env={**os.environ, 'PYTHONPATH': BACKEND, 'PYTHONDONTWRITEBYTECODE': '1'},
            capture_output=True, text=True)
        hooks.write(json.dumps({'hook': spec, 'rc': result.returncode, 'stdout': result.stdout.strip()[-3000:],
                                'stderr': result.stderr.strip()[-1500:]}) + '\n')
        hooks.flush()
        print('seed rc', result.returncode, result.stdout.strip()[:600], result.stderr.strip()[-800:], flush=True)
        if result.returncode:
            raise SystemExit('seed failed')
        for game in json.loads(result.stdout.strip().splitlines()[-1])['games']:
            subs[f"DATE{game['number']}"] = game['slate_date']
            subs[f"GAME{game['number']}"] = game['game_id']
    elif kind == 'mark':
        marks[spec['name']] = time.time()
        hooks.write(json.dumps({'hook': spec}) + '\n')
        hooks.flush()
    elif kind == 'until':
        time.sleep(max(0, marks[spec['name']] + spec['seconds'] - time.time()))
        hooks.write(json.dumps({'hook': spec}) + '\n')
        hooks.flush()


last = {}
for raw in open(journey):
    if not raw.strip() or raw.lstrip().startswith('#'):
        continue
    spec = json.loads(substitute(raw) if '"_hook"' not in raw else raw)
    if '_hook' in spec:
        hook(spec)
        continue
    last = spec
    proc.stdin.write(json.dumps(spec) + '\n')
    proc.stdin.flush()
    result = read()
    if not result.get('ok'):
        print('FAILED', json.dumps(spec), json.dumps(result)[:900], flush=True)
        break
    if spec['action'] in ('proof', 'snapshot'):
        print(spec['action'], spec.get('name', ''), json.dumps(result)[:240], flush=True)
if proc.poll() is None and last.get('action') != 'cleanup':
    proc.stdin.write('{"action":"cleanup"}\n')
    proc.stdin.flush()
    read()
proc.stdin.close()
proc.wait(timeout=180)
print('exit', proc.returncode, flush=True)
