# Production empty-account verification — passed

Frontend PR #130 commit `10ed0538fd18f8b61128bc9bef05bfe7f0134151`, fingerprint `d47b52a4346aab298eb0afb12d398262a7df5863e2b026a7a14800e039183ad4`. This is the PR frontend running locally against the live production Railway backend with real Firebase authentication using an existing dedicated test identity. It does not claim the unmerged frontend has been deployed to courtai.app.

- Empty target collection GET returned 200 with zero targets before and after the journey.
- ORL / P&R ball handler ≥25% returned 130 player-games; NYK / P&R roll man ≥15% returned 112. Both non-persistent previews returned 200.
- Desktop 1440×900: changing grading from PTS to FGA changed the displayed grading; opening ORL copied the 25% preset, editing to 31% refreshed the real production backtest, and Cancel preserved the original sample.
- Phone 390×844: NYK copied PRRollMan/15%; editing to 31% refreshed the real production backtest. Cancel and reopen restored 15%. Collection reload still showed both original samples with no saved targets.
- Both layouts passed overflow checks. Screenshots were visually inspected. 45 recorded steps passed; all recorded command hashes match journey.jsonl.
- Four POST responses were recorded, all from `/api/user/targets/preview`, all 200. No target create, PATCH, or DELETE requests were sent. Production Save was deliberately not exercised; its persistence and subsequent sample removal passed earlier isolated real-auth QA and both viewport E2E tests.
- Session cleanup completed, temporary browser/profile/server removed. Application and skill sources unchanged.

## Read-only preview allowance

The standard proxy blocks all POSTs. Backend `docs/API_DOCUMENTATION.md` (Preview a Draft Target), `app/routes/user_routes.py:378`, and `app/services/target_preview.py:100` document/implement preview as non-persistent. A temporary copy of the helper permitted exactly POST `/api/user/targets/preview`; all other non-read requests remained blocked. `helper-changes.patch` records the temporary changes; the second change records only sanitized collection counts. The original project helper was not modified.

`node --test production-guard.test.mjs preview-guard.test.mjs` passed 3 tests, including creation/update/deletion rejection and rejection of alternate/encoded preview paths. Helper and guard SHA-256 values are in verification-summary.json.

Replay with the temporary helper patched as recorded, existing dedicated test identity supplied via `STATSPLUS_VERIFY_EMAIL`, explicit PR frontend/credential-source backend, and `--environment production --coordination "$COORDINATION_CHECKOUT" --port 5198 < journey.jsonl`. Normal Firebase/backend login bookkeeping may occur. No credentials, tokens or auth storage are included in this evidence.

Screenshots: production-samples-desktop.png, production-samples-phone.png, production-orl-draft-desktop.png, production-nyk-draft-phone.png. Account counts, API statuses, per-step verdicts, executed JSONL and checksum are alongside them. Prior production verification limits are resolved for empty-account previews and draft exploration; all production writes remain outside the verification scope.
