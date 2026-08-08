# Domain Docs

This repository uses a single-context domain-document layout.

## Before exploring

Read these when they exist:

- `CONTEXT.md` at the repository root
- Relevant ADRs under `docs/adr/`

If they do not exist, proceed silently. Domain-modeling skills create them when terminology or architectural decisions are resolved.

## Layout

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

## Vocabulary

Use terminology defined in `CONTEXT.md`. Avoid synonyms that its glossary explicitly rejects.

If a required concept is absent, reconsider whether new terminology is necessary or flag the gap for domain modeling.

## ADR conflicts

Explicitly identify recommendations that conflict with an existing ADR rather than silently overriding it.
