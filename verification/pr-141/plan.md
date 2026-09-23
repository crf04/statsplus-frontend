# PR 141 Visual QA plan
Frontend: /Users/chrisfu/statsplus-frontend at 53be6812b22d2f21ab49c9494a7969ae4a6e74e2.
Backend: /Users/chrisfu/statsplus-local/backend at ab9b92c533973e43d50a04170963056672fa736b.
Use isolated QA, real Firebase auth, and frozen sports seed. Production optional and omitted.

| Behavior | Plausible regression | Trigger | Required result |
| --- | --- | --- | --- |
| Landing desktop/phone | Old heading, overlap, clipping, wrong responsive layout | Open /; wait 3s; resize | Ask the box score, Run it accessible name, no overflow; court avoids heading, readable tagline; columns desktop, stacked steps and arrow-only submit phone |
| search-query | Submission broken or backend error | Enter LeBron James last 10 games | Game Logs, LeBron James and 10-game sample, GET /api/games/game_logs 200 |
| search-return | Stale query retained or wrong route | Back to search | /, new heading, empty textbox |
| Browse | Structured workspace inaccessible | Browse without a query | Structured workspace opens |
| Saved Filter Sets | Dialog inaccessible | Return and open Saved Filter Sets | Dialog opens; no saving or deleting |

Save each executed JSON command, its SHA-256, proofs, ARIA, metadata, and video. Inspect screenshots manually. Verify cleanedUp true and runtime absent. Existing cloud gate applies to exact frontend revision; run coordination gate locally. Report failures without changing application code. Phone proofs establish visual coverage only, not phone interaction coverage. Signed-out, provider failures and disabled QA integrations are outside scope.
