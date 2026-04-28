# Deployment Guide

This frontend is a Create React App project that produces static files in `build/`. It can be deployed to any static host, but production API routing needs a little care: the current app uses same-origin API paths in production, so `/api/*` requests must be proxied or rewritten to the backend service by the hosting platform.

## Before Deploying

1. Confirm the backend API is deployed and reachable over HTTPS.
2. Configure frontend environment variables in the hosting provider.
3. Configure a rewrite/proxy from `/api/*` to the backend.
4. Configure single-page app fallback so browser refreshes serve `index.html`.
5. Build and smoke-test the app locally.

## Environment Variables

Set only the values your deployment actually uses. Do not commit production `.env` files that contain secrets, private URLs, or internal credentials.

Common frontend variables:

```env
REACT_APP_NAME=NBA Game Logs
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=production
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_ENABLE_ERROR_REPORTING=false
REACT_APP_DEBUG=false
REACT_APP_API_TIMEOUT=10000
GENERATE_SOURCEMAP=false
```

Firebase client configuration, if authentication is enabled:

```env
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
```

Development builds can use `REACT_APP_API_BASE_URL` to point at a local or remote backend. Production builds currently use same-origin API paths, so set up hosting rewrites for `/api/*` instead of relying on `REACT_APP_API_BASE_URL`.

## Build

```bash
npm install
npm run build
```

The production artifacts are written to `build/`.

To smoke-test locally:

```bash
npx serve -s build
```

Then open [http://localhost:3000](http://localhost:3000).

## Backend API Requirements

The deployed backend should provide:

- `GET /api/players`
- `GET /api/teams`
- `GET /api/games/game_logs`
- `GET /api/players/profile`
- `GET /api/teams/stats`
- `POST /api/nl-query`

If the frontend and backend are served from different origins, configure either:

- a same-origin hosting rewrite/proxy from `/api/*` to the backend, or
- backend CORS that allows the frontend domain, along with source changes to use the remote API base URL in production.

## Vercel

Recommended settings:

- Framework preset: Create React App
- Build command: `npm run build`
- Output directory: `build`

Add a `vercel.json` only if this repository does not already have equivalent project settings:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_BACKEND_HOST/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Replace `https://YOUR_BACKEND_HOST` in the hosting configuration with your deployed backend origin. Do not include backend secrets in the frontend project.

## Netlify

Recommended settings:

- Build command: `npm run build`
- Publish directory: `build`

Configure redirects in Netlify project settings or with a `_redirects` file generated as part of your deployment process:

```text
/api/*  https://YOUR_BACKEND_HOST/api/:splat  200
/*      /index.html                           200
```

Replace `https://YOUR_BACKEND_HOST` with the backend origin.

## GitHub Pages

GitHub Pages can host the static build, but it does not provide a native backend proxy. Use it only when:

- the frontend can call a backend with working CORS, and
- the app is configured to use the correct production API base URL, or
- an external proxy/API gateway handles `/api/*` requests.

If deploying under a repository subpath, set the `homepage` field in `package.json` and validate routing before publishing.

## AWS S3 and CloudFront

1. Upload the `build/` contents to S3.
2. Serve through CloudFront with HTTPS.
3. Configure custom error responses or CloudFront Functions so SPA routes return `index.html`.
4. Route `/api/*` to the backend origin through CloudFront behaviors.

## Security Notes

- Do not commit real service account keys, private API keys, backend tokens, or database credentials.
- Keep production secrets in the backend or hosting provider secret store.
- Firebase web config is client-side configuration, but Firebase rules and authorized domains still need to be locked down.
- Prefer HTTPS-only API URLs and hosting.
- Disable production source maps if they reveal implementation details you do not want public.

## Troubleshooting

API requests return 404:

- Confirm the host rewrites `/api/*` to the backend.
- Confirm the backend route path matches the frontend route path, especially `/api/games/game_logs`.

API requests fail with CORS errors:

- Prefer same-origin proxying through the frontend host.
- If using cross-origin requests, allow the exact frontend origin in the backend CORS policy.

Blank page after deploy:

- Check browser console errors.
- Confirm the build completed successfully.
- Confirm SPA fallback routes serve `index.html`.

Authentication fails:

- Confirm all Firebase `REACT_APP_FIREBASE_*` values are present.
- Confirm the deployed frontend domain is authorized in Firebase.
