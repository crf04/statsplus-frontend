# Connect page evidence

Frontend revision: `942a4001ef3c5df385fcdf94f61a8278bf2c0b23`.
Captured October 6, 2026 using the verify-statsplus production helper with viewport-only capture and scroll-offset support. Local frontend connected to production Railway; real Firebase authentication, no fixtures. Desktop 1440×900; phone 390×844.

All 15 journey steps passed, including Copy → Copied at both widths and no horizontal overflow. Page is static and made zero API requests. Five screenshots inspected. Owned browser/server cleaned up and runtime removed. `journey.jsonl` contains the replay; SHA256SUMS covers evidence files.

The updated ChatGPT instructions follow the authenticated live flow tested on October 6. Both ChatGPT and the existing Claude production connector executed get_slate successfully. Live connector checks returned the October 6 empty Slate with stale schedule and unavailable injuries/player-pool caveats; they do not establish data freshness or populated game behavior. Personal client-chat screenshots are intentionally excluded from this public evidence branch.
