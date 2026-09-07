# Page performance verification

Runtime revision: `91040211959a13f8a25f434ccfd4c3cabce7472d`.
Production-built local frontend connected to the real authenticated Railway API.
Desktop: 1440×900; phone viewport: 390×844. No simulated phone CPU/network throttling.

| Behavior              | Observed result                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Search profile        | One initial Playtypes read instead of two; no unused comparison reads for Shooting Type, Zone Shooting, or Archetype      |
| Nonchart routes       | Chart.js and Recharts absent on initial Matchups and saved Target loads; 189.09 KB gzip deferred; Search still loads both |
| Historical slate Back | No repeated Target-resolution request; annotations returned in 112 ms desktop / 101 ms phone; base slate still refreshed  |
| Game Logs 10→5→10     | No repeated game-log request; identical rows restored                                                                     |
| Saved Target preview  | Request started 2 ms after Target list response on both widths, down from 605–609 ms; API itself still took 1169–1314 ms  |

Revisit timings include automation and UI work and varied across runs; request elimination is the reliable result, not a field latency percentile. The cache holds successful decoded results for at most 30 seconds and 32 entries total, scoped by account and complete request identity. Session changes clear it and fence late completions; Target writes invalidate historical resolutions. Current/implicit/future slate dates remain uncached. Explicit refresh remains fresh, preserves a chosen opponent, and initializes one after initial-load failure.

Live failure journeys blocked a route download, navigated elsewhere, and recovered through Reload on both widths. An aborted initial game-log request recovered through Apply with an initialized opponent. Signed-out Apply issued no game-log request. Existing browser sessions were preserved; owned QA services were stopped.

Validation: lint, formatting, 655 Jest tests, production build, 103 browser tests with two deployment-only skips, and coordination checks including 13 API contracts. Browser tests used the owning configuration with only the local server/base URL port changed to 4195, CI enabled, four workers and zero retries. Backend/API contract unchanged.

Independent Opus reviews covered all three Astra implementation slices and mutation-tested their new tests. Material findings were fixed and re-reviewed. Final small punctuation/retry/assertion corrections passed targeted red/green checks and the full gate.

[Request measurements](measurements.jsonl) · [Revisit and recovery actions](actions.jsonl)
