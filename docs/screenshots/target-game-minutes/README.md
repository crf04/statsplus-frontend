# Target player-game minutes screenshots

Captured with real Firebase authentication at desktop (1440×900) and phone
(390×844) widths. No mocked responses or seeded data were used.

- `production-desktop.png` and `production-phone.png`: local frontend connected
  directly through its Vite proxy to the production Railway backend. These show
  the new control and layout. The current production backend does not yet apply
  the new condition, so the sample remains 153 player-games.
- `integrated-desktop.png` and `integrated-phone.png`: local frontend connected
  to the changed local backend using live Railway PostgreSQL data. The >10
  condition reduces the same DET sample from 153 to 135 player-games. Every
  retained appearance exceeds 10 minutes; season baselines and the opponent-game
  denominator remain unchanged. Clearing the condition restores 153 games.

Backend base: `95566b0d9a0ac249046b2495a4f3ced5102698de`. Frontend base:
`24ad56c32acaee94f9c5ef5204c320f56d84f28b`. The reviewed application diffs were
unchanged during capture and are included in this feature's commits.

No saved production Targets were changed. Local schema creation was disabled;
QA services and temporary configuration were removed afterward. Deploy backend
support before the frontend. Tracking: crf04/statsplus#64.
