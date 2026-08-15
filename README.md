# CourtAI

A React frontend for exploring NBA game-level data through structured filters, natural language queries, and chart-based visualizations. Built to make per-game player and team statistics easier to slice without writing SQL.

**Live app:** [courtai.app](https://courtai.app) _(authentication required)_

## Screenshots

_Screenshots and a short walkthrough live in [`docs/assets/`](docs/assets/)._

## Overview

CourtAI sits in front of an NBA game-log API and gives the same data three ways:

1. **Structured filtering** for users who know exactly what slice they want (player, team, matchup, season, date range, stat thresholds).
2. **Natural language queries** for plain-English questions like _"Giannis at home since November without Khris Middleton shooting 15+ times"_. The frontend forwards the prompt to a backend endpoint that resolves it into a structured filter set and returns matching game logs.
3. **Player and team profiles** with summaries, rolling averages, opponent breakdowns, and chart-based views of assist patterns, playstyle, shooting zones, and performance trends.

The natural-language path is the one I cared most about — the structured filters are the fallback when the prompt is ambiguous.

## Routes and navigation

The shared navigation exposes the game-log search at `/` and the date-based NBA slate at
`/matchups?date=YYYY-MM-DD`. Omitting `date` opens today's Eastern-time slate. Unknown client-side
paths return to `/`, and Vercel's SPA fallback keeps direct links to `/matchups` working. Signed-out
visitors keep the shared shell and see a sign-in prompt on the matchups route rather than being
redirected.

## Architecture

```
Browser  ──►  CourtAI (Vercel static)  ──►  /api/*  ──►  Backend (separate repo)
                    │
                    └─► Firebase Auth (ID token attached to every API request)
```

A few decisions worth calling out:

- **Same-origin API in production.** Vercel rewrites `/api/*` to the backend origin, so the frontend never deals with CORS. Production builds deliberately ignore `REACT_APP_API_BASE_URL`; in development it selects a direct backend origin.
- **Auth on the frontend, authorization on the backend.** Firebase issues an ID token; an Axios interceptor (`src/utils/axiosConfig.js`) attaches it to every API request. The backend verifies the token before returning data.
- **Two charting libraries on purpose.** Chart.js handles dense per-game charts (assists, shot zones) where its plugin ecosystem and label control matter; Recharts handles the simpler React-native dashboards where its declarative API is faster to write.
- **Natural language is a backend concern.** The frontend renders the prompt, posts to `/api/nl-query`, and displays the resolved filters + results. Anything LLM- or parser-related lives outside this repo.

## Features

- Multi-dimensional filtering (player, team, matchup, season, date, stat thresholds, teammates on/off court, home/away)
- Natural language query box, with a guided ladder on the landing page and a linkable query reference at `/help`
- Player profile pages with summaries, averages, recent game logs, assist profiles, and 2-vs-3 distribution charts
- Team and opponent matchup pages
- Responsive layout via Tailwind + Bootstrap + custom CSS

## Tech Stack

- **Framework:** React 18 and Vite
- **HTTP:** Axios with a Firebase-auth interceptor
- **Auth:** Firebase Web SDK
- **Charts:** Chart.js, react-chartjs-2, Recharts, plus annotation and datalabels plugins
- **Styling:** Tailwind CSS, Bootstrap, react-bootstrap, component-scoped CSS
- **Testing:** Jest + React Testing Library + Playwright

## Local Development

```bash
npm install
cp .env.example .env   # fill in values
npm start
```

The dev server runs at `http://localhost:3000`. API requests default to `http://127.0.0.1:8000` unless `REACT_APP_API_BASE_URL` is set.

Common scripts:

```bash
npm start          # dev server
npm test           # Jest in watch mode
npm run build      # production build into build/
npm run test:e2e   # hermetic browser tests with mocked API contracts
```

See [`docs/testing.md`](docs/testing.md) for the feature-testing workflow, deployed smoke tests, and
Codex exploratory QA process.

### Environment Variables

The Vite configuration preserves the existing `REACT_APP_*` variables and also accepts equivalent `VITE_*` names. See `.env.example` for the full list. The Firebase web config values are public client config by design — the security boundary is Firebase auth rules and the backend's token verification, not these keys.

## Backend API

This repo is the frontend only. It expects a backend serving:

- `GET  /api/players`
- `GET  /api/teams`
- `GET  /api/games/game_logs`
- `GET  /api/games/slate?date=YYYY-MM-DD`
- `GET  /api/players/profile`
- `GET  /api/teams/stats`
- `POST /api/nl-query`

In production the deployed host (Vercel) rewrites `/api/*` to the backend origin and ignores `REACT_APP_API_BASE_URL`. In development, set `REACT_APP_API_BASE_URL` to point at a local or remote backend.

## Deployment

Production is on Vercel, configured with:

- Build command: `npm run build`
- Output directory: `build`
- `/api/*` rewrites to the backend origin
- SPA fallback to `index.html` for client-side routes

## Project Status

CourtAI is a solo project, deployed and maintained as a portfolio piece. The backend lives in a separate (private) repository.

**Dependency maintenance.** The frontend uses Vite rather than Create React App, and unused runtime packages have been removed. Run `npm audit` as part of dependency maintenance; remaining advisories should be evaluated against the dependency path and browser bundle rather than ignored solely by severity count.

## License

[MIT](LICENSE)
