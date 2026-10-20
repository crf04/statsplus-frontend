# Domain Docs

This repository uses a single-context domain-document layout.

## Before exploring

Read these when they exist:

- `GLOSSARY.md` in the coordination repository (`crf04/statsplus`), which owns the shared vocabulary; this repository has none of its own
- Relevant ADRs under `docs/adr/`

If they do not exist, proceed silently. Domain-modeling skills create them when terminology or architectural decisions are resolved.

## Layout

```text
/
├── docs/
│   └── adr/
└── src/
```

## Vocabulary

Use terminology defined in the coordination repository's `GLOSSARY.md`. Avoid synonyms that its glossary explicitly rejects.

If a required concept is absent, reconsider whether new terminology is necessary or flag the gap for domain modeling.

## ADR conflicts

Explicitly identify recommendations that conflict with an existing ADR rather than silently overriding it.
