# Operations Console

The Operations Console is a Firebase-admin-only view at `/operations` (the
`/admin/operations` alias is retained for deep links). It displays bounded
control-plane diagnostics from `GET /api/admin/collection/diagnostics`:
collection cycles, publication streams, Collector last-seen/version state,
alerts, reconciliation items, validation summaries, usage counters, and
durable operator jobs.

## Permissions and failure states

The route is hidden from ordinary authenticated users and checks the Firebase
ID token's `admin=true`, `role=admin`, or `roles` containing `admin` claim. A
signed-out visitor sees the existing Google sign-in affordance. An ordinary
user sees a forbidden state. If Firebase cannot initialize or refresh claims,
the page fails closed and offers a permission-check retry; it never loads
diagnostics with an unverified identity.

The browser requests and decodes only the stable safe-field diagnostics
contract. Unknown fields, malformed timestamps/counts/checksums, unknown
statuses/actions, and fields associated with secrets, credentials, raw
provider responses, payloads, player facts, databases, or exceptions are
rejected at the API seam.

## Operator actions

Start, finish, retry, scoped repair, stream activation, per-stream rollback,
Collector rotation/revocation, and reconciliation resolution are reasoned
actions. Each opens an explicit confirmation dialog, requires a nonblank
human-readable reason of at least three characters, disables duplicate
submission, and reports the durable `job_id` before refreshing diagnostics.
The browser never receives or displays a machine secret. It has no remote wake,
database, direct Collector, or raw-data control.

The recovery note points operators to the private-network runbook, Windows
Task Scheduler recovery, or an always-on device on that network. Railway does
not contact the residential machine through this page.

## Backend dependency

The console is intentionally additive and depends on backend collection-control
routes. Deploy the backend contract before enabling the route for operators.
Hermetic Playwright fixtures intercept the diagnostics and admin POST routes;
they do not use Firebase, production data, or a residential Collector.
