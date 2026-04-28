# NBA Game Logs Frontend

A React frontend for exploring NBA player game logs, team profiles, and basketball statistics. The app combines structured filters, natural language search, player profile views, and chart-based visualizations to make game-level NBA data easier to inspect.

Live app: [courtai.app](https://courtai.app)

## Features

- Interactive filtering for players, teams, matchups, seasons, dates, and stat thresholds
- Natural language query interface for plain-English stat questions
- Player profile pages with summaries, averages, and recent game logs
- Team and opponent analysis views
- Chart-based visualizations for assists, playstyle comparisons, shooting patterns, and performance trends
- Responsive UI built with React, Bootstrap, Tailwind CSS, and custom component styles

## Tech Stack

- React 18 and Create React App
- React Router
- Axios for API requests
- Bootstrap, React Bootstrap, Tailwind CSS, and custom CSS
- Chart.js, React Chart.js 2, Recharts, and Chart.js plugins
- Firebase client SDK for authentication-related configuration
- Jest and React Testing Library through Create React App

## Prerequisites

- Node.js 18 or newer is recommended
- npm
- Access to a compatible backend API for game logs, players, teams, profiles, and natural language queries
- Firebase project configuration if using the authentication flows

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file from the example, then replace values with settings for your environment:

```bash
cp .env.example .env
```

Start the development server:

```bash
npm start
```

The app runs at [http://localhost:3000](http://localhost:3000). In development, API requests default to `http://127.0.0.1:8000` unless `REACT_APP_API_BASE_URL` is set.

## Environment Variables

Create React App only exposes browser environment variables prefixed with `REACT_APP_`.

Common variables used by this frontend:

```env
REACT_APP_API_BASE_URL=http://127.0.0.1:8000
REACT_APP_NAME=NBA Game Logs
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=development
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_ENABLE_ERROR_REPORTING=false
REACT_APP_DEBUG=true
REACT_APP_API_TIMEOUT=5000

REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
```

Firebase web config values are intended to be public client configuration, but service account credentials, private keys, database secrets, and backend tokens should never be committed.

## Scripts

```bash
npm start
```

Runs the local development server.

```bash
npm test
```

Starts the Create React App test runner in watch mode.

```bash
npm run build
```

Creates an optimized production build in `build/` and runs the CRA lint/build checks.

```bash
npm run eject
```

Ejects from Create React App. This is irreversible and usually unnecessary.

## Backend API

The frontend expects a backend that serves these routes:

- `GET /api/players`
- `GET /api/teams`
- `GET /api/games/game_logs`
- `GET /api/players/profile`
- `GET /api/teams/stats`
- `POST /api/nl-query`

Development builds can point directly to a backend with `REACT_APP_API_BASE_URL`. Production builds currently use same-origin API paths, so the deployed frontend host should proxy or rewrite `/api/*` requests to the backend service.

## Deployment

The app builds to static files and can be hosted on Vercel, Netlify, GitHub Pages, S3/CloudFront, or another static hosting platform.

For production deployments, configure:

- Build command: `npm run build`
- Publish directory: `build`
- API proxy or rewrite from `/api/*` to the backend
- SPA fallback to `index.html` for client-side routes
- Environment variables for Firebase and optional app flags

See [DEPLOYMENT.md](DEPLOYMENT.md) for platform notes.

The current production app is hosted at [courtai.app](https://courtai.app).

## Testing and Building

Run tests before larger behavior changes:

```bash
npm test
```

Create a production build before release:

```bash
npm run build
```

For documentation-only changes, a build is not normally required because no source, package, or asset files changed.

## Public Repository Caveats

- Review `.env`, `.env.production`, deployment settings, and hosting dashboards before publishing. Do not expose secrets or private backend credentials.
- The frontend depends on a separate backend; this repository alone does not provide data ingestion or API processing.
- Public demos may need a hosted backend, seeded data, and CORS/proxy configuration.
- Some stats availability depends on backend data sources and processing jobs.
