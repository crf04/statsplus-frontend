"""drive.py JOURNEY OUT_DIR [extra helper args...]

Runs the pinned control-statsplus helper over a pipe, one command per result line. Lines with "_hook" run
locally between browser steps and are not sent to the helper:
  {"_hook":"seed","games":[1]}      seed_lines.py against the session's disposable database (fixture ages start now)
  {"_hook":"mark","name":"m"}       note the moment the page under test mounted
  {"_hook":"until","name":"m","seconds":150}   wait until 150 s after that mark, so its minute clock has ticked twice
  {"_hook":"capture","name":"AVG2","stat":"PTS","player":"Austin Reaves"}   the newest game_logs body saved since the last
      browser action must carry no posted line; {{AVG2}} becomes its season_averages[0][stat] to one decimal
Placeholders {{DATE1}}, {{DATE2}}, {{DATE3}}, {{GAME1}}... in later commands take the seeded slate date / game id.
Helper stdout (results) goes to OUT_DIR.out and the hook log to OUT_DIR.hooks.jsonl.
"""
import json
import os
import subprocess
import sys
import time

EV = os.path.dirname(os.path.abspath(__file__))
FRONTEND = '/Users/chrisfu/.worktrees/statsplus-frontend-pl-picker'
BACKEND = os.environ.get('DRIVE_BACKEND', '/Users/chrisfu/.worktrees/statsplus-backend-qa-284')
COORD = '/Users/chrisfu/.t3/worktrees/statsplus/t3code-58679d10'
journey, out_dir, *extra = sys.argv[1:]
node = '/opt/homebrew/bin/node'
env = {**os.environ, 'PATH': '/opt/homebrew/bin:' + os.environ['PATH']}
proc = subprocess.Popen(
    [node, f'{EV}/' + os.environ.get('DRIVE_HELPER', 'helper-pin') + '/control-statsplus.mjs', '--frontend', FRONTEND, '--backend', BACKEND,
     '--coordination', COORD, '--out', out_dir, *extra],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=open(out_dir + '.err', 'w'), text=True, bufsize=1, env=env)
results = open(out_dir + '.out', 'w')
hooks = open(out_dir + '.hooks.jsonl', 'w')
subs = {}
marks = {}
before_action = set()


def response_files():
    responses = os.path.join(out_dir, 'responses')
    return set(os.listdir(responses)) if os.path.isdir(responses) else set()


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
            [f'{BACKEND}/.venv/bin/python', f'{EV}/seed_lines.py', database, *map(str, spec['games'])],
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
    elif kind == 'capture':
        deadline = time.time() + 10
        while not (fresh := [n for n in response_files() if n.startswith('game_logs-') and n not in before_action]):
            if time.time() > deadline:
                raise SystemExit(f'capture: no game_logs body since the last action for {spec["player"]}')
            time.sleep(0.5)
        time.sleep(0.5)
        names = sorted(fresh)
        body = json.load(open(os.path.join(out_dir, 'responses', names[-1])))
        posted = (body.get('posted_line') or {})
        value = (body['season_averages'] or [{}])[0].get(spec['stat'])
        subs[spec['name']] = '' if value is None else f'{value:.1f}'
        hooks.write(json.dumps({'hook': spec, 'file': names[-1], 'player_id': body.get('player_id'),
                                'posted_line_keys': sorted(posted), 'value': subs[spec['name']]}) + '\n')
        hooks.flush()
        print('capture', spec['name'], names[-1], body.get('player_id'), subs[spec['name']], sorted(posted), flush=True)
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
    if spec['action'] in ('open', 'click', 'fill', 'press', 'reload', 'back', 'forward'):
        before_action = response_files()
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
