# StatsPlus frontend agent guide

## Start here

Use the Node version declared in `package.json` and CI. Run `npm ci` to create a
reproducible environment.

Read [docs/testing.md](docs/testing.md) before changing test boundaries,
browser fixtures, or critical user journeys.

## Cross-repository coordination

Keep frontend-only work in this repository. When an outcome requires a backend
contract change, work through the `crf04/statsplus` coordination repository
first. Read its agent guide, architecture map, and workflow; agree on the
boundary contract before implementation, then keep the frontend branch, issue,
commits, tests, and pull request here. Keep the API decoder and
`e2e/fixtures/courtai.js` aligned with the agreed contract.

## Change loop

1. Reproduce the behavior at the narrowest public seam.
2. Add or update the smallest failing Jest or Playwright test.
3. Make the smallest coherent implementation change.
4. Update documentation and the browser fixture when public behavior changes.
5. Run the CI-equivalent completion gate:

   ```bash
   npm run lint
   npm run format:check
   npm run test:ci
   npm run build
   npm run test:e2e
   ```

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues for
`crf04/statsplus-frontend`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default canonical triage labels. See
`docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain-document layout. See `docs/agents/domain.md`.
