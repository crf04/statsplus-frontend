# CourtAI

A React frontend for exploring NBA game-level data through structured filters, natural language queries, and chart-based visualizations. Built to make per-game player and team statistics easier to slice without writing SQL.

**Live app:** [courtai.app](https://courtai.app) _(the home page is public; sign in for the workspace, Matchups and Targets)_

## Overview

CourtAI sits in front of an NBA game-log API and gives the same data three ways:

1. **Structured filtering** for users who know exactly what slice they want (player, team, matchup, season, date range, stat thresholds).
2. **Natural language queries** for plain-English questions like _"Giannis at home since November without Khris Middleton shooting 15+ times"_. The frontend forwards the prompt to a backend endpoint that resolves it into a structured filter set and returns matching game logs.
3. **Player and team profiles** with summaries, rolling averages, opponent breakdowns, and chart-based views of assist patterns, playstyle, shooting zones, and performance trends.

The natural-language path is the one I cared most about — the structured filters are the fallback when the prompt is ambiguous.

## Routes and navigation

The shared navigation exposes the game-log search at `/` and the date-based NBA slate at
`/matchups?date=YYYY-MM-DD`. Omitting `date` asks the backend's date-less Slate read, which names the
day it chose (crf04/statsplus#242); the Today button opens the current Eastern-time slate. Unknown
client-side paths return to `/`, and Vercel's SPA fallback keeps direct links working. Signed-out
visitors keep the shared shell and see a sign-in prompt on the matchups route rather than being
redirected.

| Path                               | Page                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/`                                | Log Workspace and the public home page (Slate, edges and answered ladder are readable signed out) |
| `/help`                            | Linkable query reference                                                                          |
| `/connect`                         | Connect CourtAI to Claude and other MCP clients                                                   |
| `/matchups`, `/matchups/:gameId`   | Slate for a date; one game's Matchup sheet                                                        |
| `/targets`, `/targets/:targetId`   | Saved Targets and a Target's detail, Lab and Backtest                                             |
| `/skills/injury-brief`             | The injury-brief skill page                                                                       |
| `/reports/new`                     | The Report Builder: an active account writes and publishes a text report                          |
| `/reports/:id`                     | A published report, also open to waitlisted visitors                                              |
| `/research`, `/research/@handle`   | Listed reports, Featured first, and one author's listed reports; public                           |
| `/privacy`, `/terms`               | Legal pages, also open to signed-out and waitlisted visitors                                      |
| `/operations`, `/admin/operations` | Admin operations console (the second path is an alias)                                            |

A waitlisted account sees only the public home page, the legal pages, published reports and Research, under a
banner; every other path returns home.

## Architecture

```
Browser  ──►  CourtAI (Vercel static)  ──►  /api/*  ──►  Backend (separate repo)
                    │
                    └─► Firebase Auth (ID token attached to every API request)
```

A few decisions worth calling out:

- **Same-origin API in production.** Vercel rewrites `/api/*` to the backend origin, so the frontend never deals with CORS. Production builds deliberately ignore `REACT_APP_API_BASE_URL`; in development it selects a direct backend origin.
- **Auth on the frontend, authorization on the backend.** Firebase issues an ID token; an Axios interceptor (`src/utils/axiosConfig.js`) attaches it to every API request. The backend verifies the token before returning data.
- **One charting library.** Chart.js (via react-chartjs-2, with the annotation plugin) draws every chart.
- **Natural language is a backend concern.** The frontend renders the prompt, posts to `/api/nl-query`, and displays the resolved filters + results. Anything LLM- or parser-related lives outside this repo.

## Features

- Multi-dimensional filtering (player, team, matchup, season, date, stat thresholds, teammates on/off court, home/away)
- Natural language query box, with a guided ladder on the landing page and a linkable query reference at `/help`
- The Log Workspace's Filtered vs Season card states its sample against the season: "12 of 71 games", or "0 of 71 games" when the filters leave nothing. Without a valid `season_game_count` from `/api/games/game_logs` (an older backend or a cached response) it reads "12 games". It shows no count while a request is loading or when the season has no games.
- Player profile pages with summaries, averages, recent game logs, assist profiles, and 2-vs-3 distribution charts
- Matchups: the day's Slate, a per-game Matchup sheet with posted lines, and a DFS odds panel and best-price rail odds when the backend supplies them
- Targets: saved, backtested conditions that resolve against the day's games
- Saved Filter Sets in the filter panel's Saved tab; the Game Logs default to the posted line when one exists, and list every provider and book posting it to pick from
- Connect page for the MCP connector, an in-app feedback widget, and a public home page with legal pages
- Responsive layout via Tailwind + Bootstrap + custom CSS

## Tech Stack

- **Framework:** React 18 and Vite
- **HTTP:** Axios with a Firebase-auth interceptor
- **Auth:** Firebase Web SDK
- **Charts:** Chart.js, react-chartjs-2 and chartjs-plugin-annotation
- **Styling:** Tailwind CSS, Bootstrap, react-bootstrap, component-scoped CSS
- **Testing:** Jest + React Testing Library + Playwright, plus the e2e flow runner (`npm run test:flows`)

## Local Development

Requires Node `^22.22.3 || >=24.8.0` (see `engines` in `package.json` and `.nvmrc`).

```bash
npm ci
cp .env.example .env   # fill in values
npm start
```

The dev server runs at `http://localhost:5173` (the Vite default). API requests default to `http://127.0.0.1:8000` unless `REACT_APP_API_BASE_URL` is set.

Common scripts:

```bash
npm start          # dev server
npm test           # Jest, single run (npm run test:watch to watch)
npm run build      # production build into build/
npm run test:e2e   # hermetic browser tests with mocked API contracts
```

See [`docs/testing.md`](docs/testing.md) for the feature-testing workflow, deployed smoke tests, and
Codex exploratory QA process.

### Environment Variables

The Vite configuration preserves the existing `REACT_APP_*` variables and also accepts equivalent `VITE_*` names. See `.env.example` for the full list. The Firebase web config values are public client config by design — the security boundary is Firebase auth rules and the backend's token verification, not these keys.

Error reporting is off unless `REACT_APP_SENTRY_DSN` (or `VITE_SENTRY_DSN`) is set; with it unset nothing is initialized or sent. API responses with a 5xx status are reported with their full `X-Request-ID` as the `request_id` tag, the same ID whose first eight characters appear as `(ref …)`. Page loads and web vitals are traced at `REACT_APP_SENTRY_TRACES_SAMPLE_RATE` (alias `VITE_SENTRY_TRACES_SAMPLE_RATE`, default `0.05`; a value outside 0 to 1 falls back to the default). Trace headers are not sent on API calls. Session replay stays off. Source maps upload to Sentry only when `SENTRY_AUTH_TOKEN` (with `SENTRY_ORG` and `SENTRY_PROJECT`) is present at build time.

## Backend API

This repo is the frontend only. It expects a backend serving the following; the list is representative, not exhaustive:

- `GET  /api/players`
- `GET  /api/teams`
- `GET  /api/games/game_logs`
- `GET  /api/games/slate?date=YYYY-MM-DD`
- `GET  /api/players/profile`
- `GET  /api/teams/stats`
- `POST /api/nl-query`
- `GET  /api/games/slate/edges`, `/api/games/ladder`, `/api/games/matchup`, `/api/games/seasons`
- `GET  /api/players/next-opponent`
- `/api/user/targets` (plus `preview` and `backtests`), `/api/user/saved-filter-sets`
- `POST /api/user/feedback`, `POST /api/user/attribution`
- `/api/admin/collection/*` for the operations console

In production the deployed host (Vercel) rewrites `/api/*` to the backend origin and ignores `REACT_APP_API_BASE_URL`. In development, set `REACT_APP_API_BASE_URL` to point at a local or remote backend.

## Deployment

The frontend is on Vercel. A merge to `master` deploys to the staging site (staging.courtai.app), whose
`vercel.ts` rewrites `/api/*` to the staging backend through `STATSPLUS_API_ORIGIN`. Production goes live
only when the owner promotes that deployment in Vercel. Configuration:

- Build command: `npm run build`
- Output directory: `build`
- `/api/*` rewrites to the backend origin
- SPA fallback to `index.html` for client-side routes

## Project Status

CourtAI is a solo project, deployed and maintained as a portfolio piece. The backend lives in a separate (private) repository.

**Dependency maintenance.** The frontend uses Vite rather than Create React App, and unused runtime packages have been removed. Run `npm audit` as part of dependency maintenance; remaining advisories should be evaluated against the dependency path and browser bundle rather than ignored solely by severity count.

## License

[MIT](LICENSE)
