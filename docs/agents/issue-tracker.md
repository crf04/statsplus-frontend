# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open`
- Comment: `gh issue comment <number> --body "..."`
- Apply or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares one number space across issues and pull requests. Resolve an ambiguous `#42` with `gh pr view 42`, falling back to `gh issue view 42`.

## Skill conventions

When a skill says “publish to the issue tracker,” create a GitHub issue.

When a skill says “fetch the relevant ticket,” run:

`gh issue view <number> --comments`

## Wayfinding

- Maps are issues labelled `wayfinder:map`.
- Child tickets use `wayfinder:<type>` labels.
- Use GitHub sub-issues and native issue dependencies where available.
- Fall back to task lists and `Blocked by: #<number>` when native relationships are unavailable.
- Claim work with `gh issue edit <number> --add-assignee @me`.
- Resolve work by commenting with the answer and closing the issue.
