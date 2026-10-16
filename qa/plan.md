# QA plan: crf04/statsplus-frontend#224 (Matchup summary header)

Frontend fix/matchup-header-trim@4f08ec2; backend origin/master eb7f117 (detached worktree, shared .venv);
pinned helper = coordination scripts + PROJECTION_ARCHIVE_READ_ENABLED=true (helper-pin.diff).

| Behavior | Plausible regression | Trigger | Observable outcome that fails on regression |
| --- | --- | --- | --- |
| Historical header unchanged | live rewrite leaks into finished games | open NOP @ BOS 2026-04-10 from slate | region text exactly `Fri, Apr 10, 2026 · Final. Full-season defense ranks; no Last 15 or injury report.` |
| Live header names books with lines, nothing else | "read HH:MM", "; no injury report", per-surface warnings return | seed game 1 (Dabble 13m, PrizePicks 40m), open from slate | region text exactly `<day> · Tip-off 7:30 PM. Lines from Dabble and PrizePicks.`; no `read <digit>`, `injury report`, `stale`, `unavailable`, `Lines last read` in region |
| One stale warning once the listed lines pass the bar | no warning, or old per-surface sentences | keep page open 150 s after mount (Dabble crosses its 15m bar; PrizePicks 42m stays inside 90m) | region text `... Lines from Dabble and PrizePicks. Lines last read 1Xm ago.`; `.matchup-warning` holds exactly that sentence; no `Dabble lines stale` / `Player pool stale` |
| No lines | header claims a book or warns | seed game 7 (archive emptied, nothing recorded), open from slate | region text exactly `<day> · Tip-off 7:30 PM. No lines posted yet.` |
| Phone | header wraps/overflows | phone viewport on each live state | phone proofs; assert-layout on the stale state |

Not testable in QA: a book with provider status missing/unavailable alongside books with lines (QA has no failing provider;
covered by Jest `AC1: a live header names only the books with lines…`).
