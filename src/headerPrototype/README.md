# PROTOTYPE — app header look (throwaway)

Question: what should the app header look like? Four structurally different
headers on every route, switched from the floating bar (or ← / →). The
variant rides the hash: `#proto=header&v=A` (A–D, `Now` = current header).

- Dev: `npm start`, then open `/#proto=header&v=A`.
- Standalone, no sign-in: build with `REACT_APP_PROTOTYPE=header`; a fake
  signed-in admin and captured payloads (`mock/`, borrowed from
  `prototype/home-feature-previews`) stand in for Firebase and the backend.

Lives on branch `prototype/header-look`; never merge it.
