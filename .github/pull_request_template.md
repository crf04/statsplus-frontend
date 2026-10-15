Closes #
Part of crf04/statsplus#

## Change

Describe the problem and resulting behavior.

## Verification

Live checks: <!-- user-visible, boundary, or gates only, per the coordination CLAUDE.md -->

Why they apply:

List the affected behaviors and mark each passed, failed, or untested. Record
exact frontend/backend revisions and commands; explain any omitted check.

| Check | Result | Revisions, command, and evidence |
| --- | --- | --- |
| Owning repository gates | | |
| QA user journeys against the selected backend and isolated database | | |
| Production read-only compatibility check | | |

For boundary changes, attach desktop and phone screenshots from the local
frontend connected to production Railway. User-visible changes need labelled
desktop and phone screenshots from QA or production. Label QA screenshots
separately. Include video or other action/result evidence where relevant.

Paste each verify-statsplus run's `evidence.md`. Once this pull request is
ready, the QA evidence check fails a runtime change unless user-visible has a
passed QA table and boundary also a passed production table, each from a
committed revision with this pull request's runtime files:

Known failures, untested surfaces, or disabled integrations:
