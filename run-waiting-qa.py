"""Replay the controlled waiting-read journey through the repository QA helper."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

coord = Path('/Users/chrisfu/.t3/worktrees/statsplus/t3code-4ed26896')
artifacts = Path('/tmp/statsplus-57-spec-loop')
backend, destination = map(Path, sys.argv[1:])
journey = artifacts / 'waiting-journey.jsonl'
cmd = ['node', str(coord / '.agents/skills/verify-statsplus/scripts/control-statsplus.mjs'),
       '--backend', str(backend), '--frontend', str(coord / '.statsplus/worktrees/frontend'),
       '--port', '5192', '--out', str(destination)]
process = subprocess.Popen(cmd, cwd=coord, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, text=True, bufsize=1)
seeded = False
try:
    for line in process.stdout:
        print(line, end='', flush=True)
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if value.get('action') == 'launch' and value.get('ready'):
            subprocess.run([str(backend / '.venv/bin/python'),
                            str(artifacts / 'seed-browser-waiting.py'),
                            value['qa']['database']], check=True)
            seeded = True
            process.stdin.write(journey.read_text())
            process.stdin.close()
    code = process.wait()
finally:
    if process.poll() is None:
        process.terminate()
        process.wait(timeout=30)
if destination.exists():
    data = journey.read_bytes()
    (destination / 'executed-journey.jsonl').write_bytes(data)
    (destination / 'executed-journey.sha256').write_text(hashlib.sha256(data).hexdigest() + '\n')
    seed = (artifacts / 'seed-browser-waiting.py').read_bytes()
    (destination / 'seed-browser-waiting.py').write_bytes(seed)
    (destination / 'seed-script.sha256').write_text(hashlib.sha256(seed).hexdigest() + '\n')
if not seeded:
    raise SystemExit('QA launch did not reach controlled-state setup')
raise SystemExit(code)
