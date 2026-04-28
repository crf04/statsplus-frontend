# CourtAI

A React frontend for exploring NBA game-level data through structured filters, natural language queries, and chart-based visualizations. Built to make per-game player and team statistics easier to slice without writing SQL.

**Live app:** [courtai.app](https://courtai.app) *(authentication required)*

## Screenshots

*Screenshots and a short walkthrough live in [`docs/assets/`](docs/assets/).*

## Overview

CourtAI sits in front of an NBA game-log API and gives the same data three ways:

1. **Structured filtering** for users who know exactly what slice they want (player, team, matchup, season, date range, stat thresholds).
2. **Natural language queries** for plain-English questions like *"Giannis at home since November without Khris Middleton shooting 15+ times"*. The frontend forwards the prompt to a backend endpoint that resolves it into a structured filter set and returns matching game logs.
3. **Player and team profiles** with summaries, rolling averages, opponent breakdowns, and chart-based views of assist patterns, playstyle, shooting zones, and performance trends.

The natural-language path is the one I cared most about — the structured filters are the fallback when the prompt is ambiguous.

## Architecture

```
Browser  ──►  CourtAI (Vercel static)  ──►  /api/*  ──►  Backend (separate repo)
                    │
                    └─► Firebase Auth (ID token attached to every API request)
```

A few decisions worth calling out:

- **Same-origin API in production.** Vercel rewrites `/api/*` to the backend origin, so the frontend never deals with CORS. In development the backend is hit directly via `REACT_APP_API_BASE_URL`.
- **Auth on the frontend, authorization on the backend.** Firebase issues an ID token; an Axios interceptor (`src/utils/axiosConfig.js`) attaches it to every API request. The backend verifies the token before returning data.
- **Two charting libraries on purpose.** Chart.js handles dense per-game charts (assists, shot zones) where its plugin ecosystem and label control matter; Recharts handles the simpler React-native dashboards where its declarative API is faster to write.
- **Natural language is a backend concern.** The frontend renders the prompt, posts to `/api/nl-query`, and displays the resolved filters + results. Anything LLM- or parser-related lives outside this repo.

## Features

- Multi-dimensional filtering (player, team, matchup, season, date, stat thresholds, teammates on/off court, home/away)
- Natural language query box with a prompting guide
- Player profile pages with summaries, averages, recent game logs, assist profiles, and 2-vs-3 distribution charts
- Team and opponent matchup pages
- Responsive layout via Tailwind + Bootstrap + custom CSS

## Tech Stack

- **Framework:** React 18, Create React App, React Router
- **HTTP:** Axios with a Firebase-auth interceptor
- **Auth:** Firebase Web SDK
- **Charts:** Chart.js, react-chartjs-2, Recharts, plus annotation and datalabels plugins
- **Styling:** Tailwind CSS, Bootstrap, react-bootstrap, component-scoped CSS
- **Testing:** Jest + React Testing Library

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
```

### Environment Variables

CRA only exposes browser-side variables prefixed with `REACT_APP_`. See `.env.example` for the full list. The Firebase web config values are public client config by design — the security boundary is Firebase auth rules and the backend's token verification, not these keys.

## Backend API

This repo is the frontend only. It expects a backend serving:

- `GET  /api/players`
- `GET  /api/teams`
- `GET  /api/games/game_logs`
- `GET  /api/players/profile`
- `GET  /api/teams/stats`
- `POST /api/nl-query`

In production the deployed host (Vercel) rewrites `/api/*` to the backend origin. In development, set `REACT_APP_API_BASE_URL` to point at a local or remote backend.

## Deployment

Production is on Vercel, configured with:

- Build command: `npm run build`
- Output directory: `build`
- `/api/*` rewrites to the backend origin
- SPA fallback to `index.html` for client-side routes

## Project Status

CourtAI is a solo project, deployed and maintained as a portfolio piece. The backend lives in a separate (private) repository.

**Known dependency advisories.** GitHub's Dependabot reports a number of vulnerabilities against this repo; the great majority sit inside `react-scripts@5.0.1`'s build toolchain (webpack, svgo, postcss, nth-check, workbox) and do not ship to production. Runtime-shipping deps (axios, lodash, react-router-dom, firebase) are kept on safe versions. A future migration off CRA — most likely to Vite — would clear the build-tool tail.

## License

[MIT](LICENSE)
