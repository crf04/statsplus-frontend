# Issue tracker: GitHub

`crf04/statsplus` owns observable product outcomes and their complete acceptance
criteria. `crf04/statsplus-frontend` owns focused frontend implementation
packets and internal maintenance without an observable product outcome.

Tracker publication requires explicit user authorization. Use the `gh` CLI and
always pass `--repo crf04/statsplus-frontend` for operations in this repository.

## Conventions

- Create: `gh issue create --repo crf04/statsplus-frontend --label needs-triage`
- Read: `gh issue view <number> --repo crf04/statsplus-frontend --comments`
- List: `gh issue list --repo crf04/statsplus-frontend --state open`
- Comment: `gh issue comment <number> --repo crf04/statsplus-frontend --body "..."`
- Label: `gh issue edit <number> --repo crf04/statsplus-frontend --add-label "..." --remove-label "..."`
- Close: `gh issue close <number> --repo crf04/statsplus-frontend --comment "..."`

## Product implementation packets

A child packet links its parent with `Part of crf04/statsplus#<number>` and
contains the frontend entry points, evidence, contract slice, done-when
conditions, and exact local completion gate. Read the parent before pickup.

Use `Blocked by: <owner/repo>#<number>` only when work cannot start. Express
merge ordering separately as `Merge after: <owner/repo>#<number>`.

A pull request closes only its child issue:

```text
Closes #<child issue number>
Part of crf04/statsplus#<parent issue number>
```

Leave the parent open for integrated verification. Never point `Closes`,
`Fixes`, or `Resolves` at the parent in a pull request or commit message.

## Pickup gate

Start work only when the packet names its owner and entry points, contract
slice, evidence, done-when conditions, and CI-equivalent completion gate; has
no unresolved start blocker; and its parent is neither `needs-info` nor
`wontfix`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares one number space across issues and pull requests. Resolve an ambiguous `#42` with `gh pr view 42`, falling back to `gh issue view 42`.

## Skill conventions

When a skill says “publish to the issue tracker,” use the ownership rules above.

When a skill says “fetch the relevant ticket,” run:

`gh issue view <number> --repo crf04/statsplus-frontend --comments`

## Wayfinding

- Maps are issues labelled `wayfinder:map`.
- Child tickets use `wayfinder:<type>` labels in addition to one canonical
  triage label.
- Use GitHub sub-issues and native issue dependencies where available.
- Fall back to fully qualified task-list links and `Blocked by` references when
  native relationships are unavailable.
- Claim work with `gh issue edit <number> --repo crf04/statsplus-frontend --add-assignee @me`.
- Resolve work by commenting with the answer and closing the issue.
