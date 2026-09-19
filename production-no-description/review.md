The diff satisfies the request and breaks nothing. No blocking findings.

**What the diff does**

- Both sample notes in `src/targets/SampleTargets.js` become empty strings.
- The note paragraph is removed from the sample card. The rest of the card, backtest section, and intro text are untouched.

**Verified paths**

- **Preview**: `useTargetPreview` keys requests on opponent, qualifiers, and conditions only, so an empty note changes nothing in the preview request or cache key.
- **Copy**: the Add handler calls `targetToDraft`, which copies the note verbatim. The draft note is now an empty string, which matches `blankTargetDraft`. The note textarea in the New Target dialog starts blank.
- **Save**: `targetDraftToRequest` sends the trimmed note as an empty string. The API decoder already normalises a missing or empty note to an empty string, so this is the same shape as a fresh target saved without a note.
- **Saved cards**: the saved-target card in `TargetsPage.js` already renders the note only when non-empty, so a copied sample saved as-is shows no empty paragraph.
- **Tests**: no Jest or Playwright test asserts the removed note text or the note class. The TargetsPage suite passes with the diff applied.

```
eslint  src/targets/SampleTargets.js   clean
prettier --check                        clean
jest src/targets/TargetsPage.test.js    54 passed
```

**Minor, non-blocking**

- The `note: ''` fields on the two sample objects are now redundant, since `targetToDraft` would need a string but `blankTargetDraft` already models that. Keeping them is harmless and avoids a `draft.note.trim()` crash if someone later deletes the key, so leaving them is the safer choice.
- The `.target-card-criteria .target-card-note` CSS rules still apply to saved cards, so nothing there is dead.

Not run: `npm run build` and the Playwright suite, since the change is markup and constant-only and the affected e2e spec asserts nothing about the note.
