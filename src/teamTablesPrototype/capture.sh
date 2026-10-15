#!/bin/zsh
# PROTOTYPE — throwaway (branch prototype/team-profile-tables). Re-captures the production payloads under ./mock.
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
for T in "Charlotte Hornets" "Oklahoma City Thunder" "Utah Jazz"; do for C in Traditional Playtypes Assists "Zone Shooting" "Shooting Type"; do
  get "$(echo "$T-$C" | tr 'A-Z ' 'a-z-').json" teams/stats --data-urlencode "team=$T" --data-urlencode "category=$C"; done; done
