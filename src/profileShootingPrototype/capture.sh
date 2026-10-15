#!/bin/zsh
# PROTOTYPE — throwaway. Re-captures the production payloads under ./mock.
# Mints an owner ID token from the Railway service account, then deletes it.
set -e
OUT=${0:A:h}/mock; mkdir -p $OUT; W=$(mktemp -d); trap 'rm -rf $W' EXIT
SA=""; for d in ~/.t3/worktrees/statsplus-backend/*/; do
  SA=$(cd $d && railway variables --json 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin).get('FIREBASE_SERVICE_ACCOUNT_JSON',''))" 2>/dev/null) && [ -n "$SA" ] && break; done
umask 077; print -r -- "$SA" > $W/sa.json
CT=$(~/statsplus-backend/.venv/bin/python - $W/sa.json <<'PY'
import sys, firebase_admin
from firebase_admin import credentials, auth
firebase_admin.initialize_app(credentials.Certificate(sys.argv[1]))
print(auth.create_custom_token(auth.get_user_by_email("christopherfu2004@gmail.com").uid).decode())
PY
)
KEY=$(firebase apps:sdkconfig WEB --project courtai-6eccf --json 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);r=d.get('result',d);print((r.get('sdkConfig') or r)['apiKey'])")
TOK=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$KEY" -H 'Content-Type: application/json' -d "{\"token\":\"$CT\",\"returnSecureToken\":true}" | python3 -c "import json,sys;print(json.load(sys.stdin)['idToken'])")
API=https://statsplus-backend-production.up.railway.app/api
get() { local f=$1; shift; curl -sf -G "$API/$1" -H "Authorization: Bearer $TOK" "${@:2}" -o "$OUT/$f" && echo "$f $(wc -c <$OUT/$f)" || echo "FAILED $f"; }
get players.json players
get teams.json teams
get logs.json games/game_logs --data-urlencode "player_name=Jalen Johnson"
get playtypes.json players/profile --data-urlencode "player_name=Jalen Johnson" --data-urlencode category=Playtypes
for P in "Jalen Johnson" "Stephen Curry" "Victor Wembanyama" "Shai Gilgeous-Alexander"; do for C in "Shooting Type" "Zone Shooting"; do
  get "$(echo "$P-$C" | tr 'A-Z ' 'a-z-').json" players/profile --data-urlencode "player_name=$P" --data-urlencode "category=$C"; done; done
get diet-baselines.json diet/baselines
# Unscheduled Matchups (the MCP get_matchup source), trimmed to the shot Bases.
TEAMS=(ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS)
for P in "Jalen Johnson" "Stephen Curry" "Victor Wembanyama" "Shai Gilgeous-Alexander"; do
  slug=$(echo "$P" | tr 'A-Z ' 'a-z-'); mkdir -p $W/$slug
  for O in $TEAMS; do curl -s -G "$API/matchups/unscheduled" -H "Authorization: Bearer $TOK" --data-urlencode "player_name=$P" --data-urlencode "opponent=$O" -o $W/$slug/$O.json; done
  python3 - $W/$slug $OUT/$slug-matchups.json <<'PY'
import json, os, sys
src, dst = sys.argv[1:]
out = {"diet": None, "opponents": {}, "errors": {}}
for f in sorted(os.listdir(src)):
    tri = f[:3]; d = json.load(open(os.path.join(src, f)))
    if not d.get("players"):
        out["errors"][tri] = d.get("error") or d; continue
    pl = d["players"][0]
    out["diet"] = {b: pl["diet_shares"][b] for b in ("shot_types", "shot_zones")}
    out["team"] = pl.get("tricode")
    out["as_of"] = d.get("as_of")
    out["opponents"][tri] = {b: d["teams"][0]["defense_sheet"][b] for b in ("shot_types", "shot_zones")}
json.dump(out, open(dst, "w"), separators=(",", ":"))
print(dst, len(out["opponents"]), "opponents", "errors:", list(out["errors"]))
PY
done
