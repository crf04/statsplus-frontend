# e2e adoption verification

The owning completion gate and deterministic/live verification boundaries are in
[testing.md](testing.md); the route coverage map is in [e2e-flows.md](e2e-flows.md).
Run-specific gate counts, mutations, and review verdicts belong on the pull request.

## Merge order

Merge [#157](https://github.com/crf04/statsplus-frontend/pull/157) before
[#155](https://github.com/crf04/statsplus-frontend/pull/155). It repairs three
request-observation races in the existing Playwright tests. Until then, #155's
standalone Playwright gate can fail despite a passing run; retries do not establish
first-attempt stability.

## Historical evidence

- [e2e-review-round1.md](https://github.com/crf04/statsplus-frontend/pull/155#issuecomment-5986177132)
- [e2e-review-round1-mutations.json](https://github.com/crf04/statsplus-frontend/pull/155#issuecomment-5986177239)
- [e2e-mutation-audit.md](https://github.com/crf04/statsplus-frontend/pull/155#issuecomment-5986177379) (continued in 2 comments)
- [e2e-verification.md](https://github.com/crf04/statsplus-frontend/pull/155#issuecomment-5986177712)

The historical mutation audit was moved by the same rule as the round-1 reports:
it records a particular revision's experiment, not a maintained test or reusable
verification procedure. The executable test suites remain in the repository.
Portable live provenance and labelled desktop/phone screenshots remain in
`e2e-evidence.json` and `screenshots/`.
