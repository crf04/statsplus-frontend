#!/usr/bin/env bash
# PROTOTYPE (throwaway): capture production Matchup + Selection payloads for the
# rail-odds prototype. Mints an owner ID token, curls, deletes the secrets.
# Usage: capture.sh <game_id>...
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-/Users/chrisfu/statsplus-backend}"
API=https://statsplus-backend-production.up.railway.app
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
(cd "$BACKEND_DIR" && railway variables --json) | python3 -c 'import json,sys;open(sys.argv[1],"w").write(json.load(sys.stdin)["FIREBASE_SERVICE_ACCOUNT_JSON"])' "$TMP/sa.json"
KEY=$(firebase apps:sdkconfig WEB --project courtai-6eccf --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["sdkConfig"]["apiKey"])')
CUSTOM=$("$BACKEND_DIR/.venv/bin/python" -c '
import sys, firebase_admin
from firebase_admin import auth, credentials
firebase_admin.initialize_app(credentials.Certificate(sys.argv[1]))
u = auth.get_user_by_email("christopherfu2004@gmail.com")
print(auth.create_custom_token(u.uid).decode())' "$TMP/sa.json")
ID=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$KEY" \
  -H 'Content-Type: application/json' -d "{\"token\":\"$CUSTOM\",\"returnSecureToken\":true}" |
  python3 -c 'import json,sys;print(json.load(sys.stdin)["idToken"])')
for GAME in "$@"; do
  curl -sf -H "Authorization: Bearer $ID" "$API/api/games/matchup?game_id=$GAME" > "$HERE/matchup-$GAME.json"
  for P in $(python3 -c 'import json,sys;print(" ".join(str(p["canonical_id"]) for p in json.load(open(sys.argv[1]))["players"]))' "$HERE/matchup-$GAME.json"); do
    curl -sf -H "Authorization: Bearer $ID" "$API/api/games/matchup/selection?game_id=$GAME&player_id=$P" > "$HERE/selection-$GAME-$P.json" || rm -f "$HERE/selection-$GAME-$P.json"
  done
done
