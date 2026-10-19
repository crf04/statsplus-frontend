#!/bin/zsh
# PROTOTYPE — throwaway. Re-captures the production payloads the home page
# reads into ./mock. Mints an owner ID token from the Railway service account
# (one key read, never printed), then deletes it.
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
get slate-today.json games/slate
D=$(python3 -c "import json;d=json.load(open('$OUT/slate-today.json'));print(d.get('previous_game_date') or d['slate_date'])")
echo "game day: $D"
get slate.json games/slate --data-urlencode "date=$D"
get edges.json games/slate/edges --data-urlencode "date=$D"
get resolve.json user/targets/resolve --data-urlencode "date=$D"
get ladder-start.json games/game_logs --data-urlencode "player_name=Jalen Johnson"
get ladder-narrow.json games/game_logs --data-urlencode "player_name=Jalen Johnson" --data-urlencode "players_off[]=Trae Young"
get ladder-stack.json games/game_logs --data-urlencode "player_name=Jalen Johnson" --data-urlencode "players_off[]=Trae Young" \
  --data-urlencode "teams_against[]=OPP_PTS" --data-urlencode "rank_filter[]=10" --data-urlencode "minutes_filter=25,48"
