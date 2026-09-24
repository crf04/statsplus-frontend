# season_game_count verification evidence (crf04/statsplus#88)

Backend crf04/statsplus-backend#306 @ 9ce9b45ff5a3d23f7516d7f46aef892a5ac433cf,
frontend crf04/statsplus-frontend#144 @ fe93e148399c29b16bdad60c0bbd693eb4adf955.
Recorded 2026-09-24 with verify-statsplus (`control-statsplus.mjs`).

- `qa/`: isolated QA run 2 (disposable DB from snapshot 3fe69266…, real Firebase QA identity), journeys a–d. `journey.jsonl`, `journey.sha256`, PNG + ARIA per proof, in-flight ARIA snapshots (`c-*inflight*`), video.
- `production/`: local frontend fe93e14 against deployed Railway (#306 not deployed). Graceful degrade: "5 games".
- `diagnostics/`: run 1 (stopped when the phone `assert-layout` check failed) and the base-frontend (838a104) phone proof. The phone overflow at 390px already exists on base.
- `plan.md`: verification plan and amendment.
- `production-post-deploy/`: after #306 deployed (merge 3aa10451), local frontend at master e2af53d against Railway: "5 of 60 games", "60 of 60 games" after clearing Last N, phone `assert-layout` passes (390px).
