# Public Cleanup Roadmap

This roadmap is ordered from highest to lowest priority for making CourtAI stronger as a public GitHub portfolio project and easier for hiring managers to evaluate quickly.

## 1. Finish History and Secret Hygiene

- Confirm `.env` and `.env.production` are absent from the full Git history before pushing publicly.
- Rotate or restrict any Firebase, hosting, or backend values that were ever committed, even if they are client-facing identifiers.
- Force-push only after confirming the rewritten history is the intended public history.
- Re-check GitHub repository settings, deployment dashboards, Firebase authorized domains, and backend CORS rules.

## 2. Add a Hiring-Manager Friendly Demo Path

- Add a visible "Explore demo" flow that does not require authentication.
- Seed the demo with representative players, game logs, charts, and natural language examples.
- Make the demo read-only so reviewers can inspect the product without credentials or a live backend dependency.
- Keep the authenticated flow for real usage.

## 3. Add Screenshots and a Product Walkthrough

- Add screenshots or a short GIF under `docs/assets/`.
- Show the landing/search experience, filters, player profile, table, and chart views.
- Embed the most important images near the top of `README.md`.
- Add a short walkthrough: "Ask a query, inspect filters, compare game logs, review charts."

## 4. Strengthen the README as a Portfolio Case Study

- Add a "Why I Built This" section.
- Add a "Technical Decisions" section explaining React, API proxying, auth, charting, and natural language query handling.
- Add a "Tradeoffs and Next Steps" section so reviewers see engineering judgment.
- Add links to the live app, deployment docs, and cleanup roadmap.

## 5. Add CI for Public Confidence

- Add `.github/workflows/ci.yml`.
- Run `npm ci`, `CI=true npm test -- --watchAll=false`, and `npm run build`.
- Add a build badge to the README once the workflow is green.
- Keep CI simple and fast.

## 6. Improve Test Coverage Around Core Behavior

- Add focused tests for API URL construction, filter serialization, table sorting, and natural language result mapping.
- Add tests for auth-gated versus demo access once the demo path exists.
- Prefer small unit tests around transformation logic before larger UI tests.
- Keep mocked API responses close to real backend shapes.

## 7. Create Architecture and API Contract Docs

- Add `docs/ARCHITECTURE.md` with a simple frontend-to-backend diagram.
- Add `docs/API_CONTRACT.md` with endpoint expectations and example payloads.
- Document how Firebase auth tokens are attached to API requests.
- Mention which parts of the system live outside this frontend repository.

## 8. Reduce Large Component and CSS Files

- Split `src/NaturalLanguageQuery.js` into smaller pieces: query form, prompting guide, result summary, and filter mapping helpers.
- Split the largest CSS files by screen or component responsibility.
- Extract repeated stat/column definitions into shared constants.
- Avoid broad rewrites; refactor one area at a time with tests.

## 9. Clean Up Frontend Presentation Details

- Replace emoji-heavy headings in app surfaces with icon components or cleaner labels where appropriate.
- Move inline styles in `HomePage.js` into CSS or component classes if that page remains active.
- Confirm mobile layouts for search, filters, tables, and charts.
- Add polished empty, loading, error, and unauthenticated states.

## 10. Update Project Metadata

- Add a `LICENSE` file.
- Remove `"private": true` from `package.json` or set it appropriately for a public app repository.
- Add repository metadata, keywords, and homepage to `package.json`.
- Add GitHub topics such as `react`, `nba`, `analytics`, `data-visualization`, `firebase`, and `chartjs`.

## 11. Address Dependency Maintenance

- Review `npm audit` output and separate real runtime risks from Create React App transitive noise.
- Update Browserslist data.
- Consider a future CRA-to-Vite migration after the public demo and docs are solid.
- Remove unused dependencies after confirming they are not referenced.

## 12. Optional Polish After the Core Public Pass

- Add Storybook or a lightweight component gallery for tables, cards, and charts.
- Add performance notes for large game-log tables.
- Add accessibility checks for keyboard navigation and color contrast.
- Add Open Graph images for cleaner sharing on LinkedIn and GitHub.
