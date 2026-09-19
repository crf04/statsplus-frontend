# Remove sample descriptions

User: “get rid of the description.” Remove both sample-card descriptions and leave copied draft notes empty. Only src/targets/SampleTargets.js changes: note values become empty strings and note paragraph is removed.

Full frontend gates; independent read-only review. Repeat production read-only 45-step journey with additional assertions that sample description elements are absent and both copied Why fields are empty. This covers both presets, desktop and phone, live preview refresh, cancel/reopen, and zero saved targets after reload. Production mutation endpoints stay blocked by the previously tested exact preview allowance; no Save in production.

Refresh PR #130 source and screenshot evidence. No backend/API changes.
