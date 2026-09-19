No material issues. The diff does exactly what the request asked.

- **Card descriptions restored.** The two Explore players notes and the note paragraph in the card are byte-identical reversals of commit d443d48. The note flows into the draft via `targetToDraft`, so Add to my targets copies it again.
- **Only the section intro removed.** The paragraph under the heading and its orphaned CSS rule are gone. The remaining `.sample-targets-intro` container and h2 rules still apply.
- **Heading capitalized consistently.** All seven test selectors in the Jest file and the one Playwright selector now match Sample Targets. No other reference to the old casing or the removed intro text exists in src, e2e, or docs.
- **Verified.** Prettier passes on the four changed files. The TargetsPage suite passes, 54 tests.

One non-blocking note: the card renders the note unconditionally, while the saved-target card in the page component guards it with a truthiness check. Both samples always have a note, so this is harmless.
