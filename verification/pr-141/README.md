# PR 141 — QA evidence

All five planned behaviors passed in isolated QA with real Firebase authentication. Production: untested (optional for Visual tier).

Frontend: 53be6812b22d2f21ab49c9494a7969ae4a6e74e2; clean checkout at /Users/chrisfu/statsplus-frontend.
Backend: ab9b92c533973e43d50a04170963056672fa736b at /Users/chrisfu/statsplus-local/backend. Working-file fingerprint: 4633d10121f58905bbe9e9a4ad52a50980cdf22384fc12134146511ebd0ff42a.
Coordination helper revision: b87a5830985e17d3ab3b24703599bf45ee9e3c82. Source/helper hashes are in each session manifest.
Frozen sports snapshot SHA-256: 3fe69266e135d9ed9e6f671d01e7034c7d529a6ee3a9fa6395851b003ee222f5.

## Commands

Run from the coordination root:

```sh
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs --frontend /Users/chrisfu/statsplus-frontend --out /tmp/statsplus-141-evidence/qa
node .agents/skills/verify-statsplus/scripts/control-statsplus.mjs --frontend /Users/chrisfu/statsplus-frontend --out /tmp/statsplus-141-evidence/qa-phone-detail
python3 scripts/check.py
```

Commands were fed interactively over stdin, in the exact order saved in journey.jsonl and phone-detail.jsonl. A manual pause exceeding 3 seconds occurred between opening the landing and its desktop proof. For replay, use a new output directory and feed these JSONLs; retain that pause before landing-desktop. The initial query-result proof caught loading; query-result-loaded is the completed result after the exact-query HTTP 200 assertion. Session results preserve individual parsed-command hashes; journey.sha256 and phone-detail.sha256 hash the saved files.

## QA verdicts

| Behavior | Verdict | Evidence |
| --- | --- | --- |
| Signed-in landing desktop and phone | passed | qa/landing-desktop and qa/landing-phone: heading, accessible Run it button, no horizontal overflow. Desktop court stays below heading, readable tagline, three columns; phone arrow-only button and stacked steps. qa-phone-detail/landing-phone-steps confirms all three stacked steps. |
| search-query | passed | Enter LeBron James last 10 games; Game Logs, ten data rows, correct player and sample; GET /api/games/game_logs with player_name=LeBron James, season_filter=2025-26, game_filter=10 returned 200. qa/query-result-loaded. |
| search-return | passed | Back to search; URL /, Ask the box score heading, textbox value empty. qa/returned-landing. Visible text inside the empty textbox is a placeholder. |
| Browse without a query | passed | /?browse=1 with structured controls and Apply Filters visible. qa/browse-workspace. |
| Saved Filter Sets | passed | Named dialog and empty saved-sets state; GET returned 200. qa/saved-filter-sets. No save/delete actions. |
| Cleanup/evidence | passed | Both session.json files have cleanedUp true, runtime paths absent, PNG/ARIA/JSON sets and nonempty WebM video retained. |

Screenshots were visually inspected. No visual defect found in the requested surface. In the supplemental scrolled phone proof, the section title has scrolled behind the sticky nav; all three step cards are visible.

## Limits

Owning frontend gate is the existing cloud pass reported on PR 141 at the same exact revision: lint, format, 757 Jest tests, build, 112 Playwright passed and 2 deployment-only checks skipped. Not rerun locally. Local coordination gate passed (4 tests, 13 endpoints). The resolver's separate /Users/chrisfu/statsplus-backend checkout has preexisting local changes and was not used for QA or modified.

No production check. No signed-out, reduced-motion, provider-failure or phone query-navigation verification. QA disables Redis, paid AI fallback, DFS and injury-provider calls. Screenshot resizing proves layout, not phone search interaction. The supplemental click only brings the third ladder step into view; it does not certify ladder behavior.
