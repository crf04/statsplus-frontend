import json, subprocess, sys, os
helper = "/Users/chrisfu/.t3/worktrees/statsplus/t3code-58679d10/.agents/skills/verify-statsplus/scripts/control-statsplus.mjs"
journey, args = sys.argv[1], sys.argv[2:]
env = dict(os.environ, PATH="/opt/homebrew/bin:" + os.environ["PATH"])
p = subprocess.Popen(["node", helper, *args], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, env=env, cwd="/Users/chrisfu/.t3/worktrees/statsplus/t3code-58679d10")
def read():
    line = p.stdout.readline()
    print(line.rstrip()[:600], flush=True)
    return json.loads(line) if line.strip() else None
launch = read()
ok = bool(launch and launch.get("ok"))
for raw in open(journey):
    raw = raw.strip()
    if not raw or not ok: continue
    if raw.startswith("#hook "):
        r = subprocess.run(raw[6:], shell=True, env=env); print("hook exit", r.returncode, flush=True)
        if r.returncode: ok = False
        continue
    p.stdin.write(raw + "\n"); p.stdin.flush()
    res = read()
    ok = bool(res and res.get("ok"))
p.stdin.close()
for line in p.stdout: print(line.rstrip()[:600])
sys.exit(p.wait() or (0 if ok else 1))
