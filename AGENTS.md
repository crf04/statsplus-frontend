# StatsPlus frontend agent guide

## Start here

Use the Node version declared in `package.json` and CI. Run `npm ci` to create a
reproducible environment.

Read [docs/testing.md](docs/testing.md) before changing test boundaries,
browser fixtures, or critical user journeys.

## Cross-repository coordination

Start every observable product outcome in the `crf04/statsplus` coordination
repository, including frontend-only outcomes. Keep the focused frontend
implementation issue, branch, commits, tests, and pull request here. Internal
maintenance without an observable product outcome may start in this repository.

Before implementing a linked product outcome, read its parent issue and the
coordination repository's agent guide, architecture map, and workflow. Agree on
the boundary contract there before changing the backend contract. Keep the API
decoder and `e2e/fixtures/courtai.js` aligned with that contract.

## Change loop

1. Reproduce the behavior at the narrowest public seam.
2. Add or update the smallest failing Jest or Playwright test.
3. Make the smallest coherent implementation change.
4. Update documentation and the browser fixture when public behavior changes.
5. Inner loop: run `npm run check:changed`. It runs lint, format:check,
   typecheck:e2e and build, Jest only for tests affected by the diff against
   `origin/master`, and browser specs and flows only for changed files, plus the
   `@critical` subset when `src/`, fixtures, the bridge or config changed.
6. Completion gate: `npm run check` is the full suite and must pass in CI (all
   three jobs green: validate, E2E, e2e flows) before a pull request is marked
   ready or merged.

   ```bash
   npm run check
   ```

   It runs lint, format:check, test:ci, build, test:e2e, typecheck:e2e and
   test:flows in order. CI runs the same commands as parallel jobs, so a
   command added to `.github/workflows/ci.yml` belongs in `check` too.

## Agent skills

### Issue tracker

Use this repository for frontend implementation packets and internal
maintenance. See `docs/agents/issue-tracker.md` before creating, picking up,
linking, or closing an issue or pull request.

### Triage labels

Use the five default canonical triage labels. See
`docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain-document layout. See `docs/agents/domain.md`.
