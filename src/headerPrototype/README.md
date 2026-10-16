# PROTOTYPE — app header look (throwaway)

Question: what should the app header look like? Structurally different
headers on every route, switched from the floating bar (or ← / →). The
variant rides the hash: `#proto=header&v=I` (I, J, K, A, D, F; `Now` = current header).

Round 2 (2026-10-16) was redone against the Z4 home page (scoreboard ticker
under the header): B, C, E, G, H were dropped, I–K added.

- Dev: `npm start`, then open `/#proto=header&v=A`.
- Standalone, no sign-in: build with `REACT_APP_PROTOTYPE=header`; a fake
  signed-in admin and captured payloads (`mock/`, refreshed by
  `./capture.sh`) stand in for Firebase and the backend.

Lives on branch `prototype/header-look`; never merge it.
