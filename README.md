# Corrected section heading and description

Latest source: `8ec70faf21bffce90dfb6fdbadf6e156e0e11b61`. See [production-heading](production-heading) for 48 passing actions and refreshed desktop/phone screenshots. Section description removed; card descriptions restored.

# Current evidence: descriptions removed

Latest frontend commit `d443d48` removes both sample descriptions and clears copied notes. [Production verification, screenshots, and independent review](production-no-description/README.md) passed on this exact revision. Older evidence below retains the previous appearance for history.

---

# Latest verification

Production empty-account checks now pass. See [production-empty/README.md](production-empty/README.md) for the new live-data samples, desktop/phone edit-and-cancel journeys, zero target writes, screenshots and exact replay evidence. This resolves the prior sample-preview verification limit below.

---

# Sample targets PR evidence

Frontend commit: `10ed053` (verified content committed without changes). Tested base: `2f92cba52430458822c7ac664a9598409b51cc80` plus working diff, fingerprint `e69156f92fcdd4a43257c6af142fd392f3fda1b9b7dbd3c2f1d3f6088cf01bf9`. Backend QA: `a994f66b257a073991ac0539d7996fba0e3d9fb1`. Coordination: `54a4cb6fcb78b29d8ccc65c9859d54f50ee30ca5`.

## Automated checks — passed

`npm run lint`, `npm run format:check`, `npm run test:ci` (47 suites, 755 tests), `npm run build`, `npm run test:e2e -- --workers=3` (111 passed; two deployment-only checks skipped), `git diff --check`. Coordination `python3 scripts/check.py` passed with explicit frontend/backend worktree environment overrides. Fresh-context independent Claude review found no blocking findings and verified regressions with temporary mutations; exact preset thresholds were individually mutated and both tests failed, then restored. See review.md.

## QA — passed

Real Firebase authentication and actual selected backend using an isolated PostgreSQL snapshot. Snapshot SHA-256: `3fe69266e135d9ed9e6f671d01e7034c7d529a6ee3a9fa6395851b003ee222f5`.

The empty account shows two samples: ORL P&R ball handler ≥25%, NYK P&R roll man ≥15%. Both preview requests returned 200 and displayed real backtests. Desktop 1440×900 and phone 390×844 layout checks passed. Phone interaction copied the ORL sample, changed 25% to 31%, saved through POST /api/user/targets (201), returned to the list, verified samples disappeared and the saved target survived reload. Controlled failures/retry/cancel and both viewport save journeys are covered by the automated tests.

Replay command from coordination checkout (select the frontend/backend worktrees):

```sh
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs \
  --frontend "$FRONTEND_CHECKOUT" --backend "$BACKEND_CHECKOUT" \
  --port 5197 < qa/journey.jsonl
```

Screenshots, executed journey and checksum are in qa/. Session cleanup was confirmed and the owned database/services stopped.

## Production compatibility — passed for saved-account collection

Local frontend against production Railway, real authentication, read-only proxy. Collection and saved backtests returned 200. Desktop and phone evidence is in production/. The account has existing targets, so it correctly does not display samples. Empty-account sample previews are **not verified in production**: the helper blocks POSTs including the non-persistent preview endpoint. QA proves the new sample flow. Local backend revision is not claimed as the deployed Railway revision.

```sh
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs \
  --environment production --frontend "$FRONTEND_CHECKOUT" \
  --backend "$CREDENTIAL_SOURCE_BACKEND" --port 5198 < production/journey.jsonl
```

Cleanup confirmed. Full-page captures show the existing fixed-background screenshot behavior (white outside the initial viewport), also present on the production saved collection; the independent review checked a scrolled phone viewport and found no overflow.
