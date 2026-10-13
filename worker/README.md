# Candy Bank

Live: https://candy-bank.timidan-knock.workers.dev

One Worker and one D1 database; no signing keys or inbound homelab connectivity.
Flow: browser → Worker/D1 queue → outbound relay → Robinhood testnet → Worker status.
D1 atomically checks each IP's daily count and inserts the unique normalized address.

| Route | Request | Response |
| --- | --- | --- |
| `POST /claim` | JSON `{address}` | `{state}`; existing claims return their state and optional `tx` |
| `GET /claim/:address` | Address in path | `{state: "none"|"queued"|"paid"|"failed", tx?}` |
| `GET /queue` | Bearer `BANK_TOKEN` | `{claims: [{address}]}`, oldest first, maximum 20 |
| `POST /done` | Bearer `BANK_TOKEN`, JSON `{address, tx}` or `{address, error}` | Current `{state, tx?}` |

Addresses are 20-byte hexadecimal strings, normalized to lowercase; zero is rejected.
One claim per address ever. Failed/paid records never become queued again. Each IP
can create three claims per UTC calendar day; duplicates do not consume another slot.
Status codes: 400 invalid input, 401 missing/wrong relay token, 403 disallowed browser
origin, 404 unknown route/claim on `/done`, 413 oversized body, 429 IP quota, 503 service
unavailable. Only queued records can transition through `/done`; repeated acknowledgements
cannot overwrite a terminal result. Errors are stored privately, not exposed by status.

CORS: `https://*.knock-ej6.pages.dev`, the production Pages origin
`https://knock-ej6.pages.dev`, `https://knock.timidan.xyz`, and `http://localhost:*`.
Requests without an Origin header are permitted (relay and CLI use).

Deploy from this directory with `npm install`, then `npx wrangler deploy`.
The existing D1 binding is in `wrangler.jsonc`; `schema.sql` is already applied remotely.
Do not recreate/delete the database: it holds the lifetime claim history.
`BANK_TOKEN` is already set via `wrangler secret put BANK_TOKEN`; the only local copy
is `../.env.bank` (mode 600 and gitignored). Never print it or put it in frontend env.

The live verification queued three addresses, rejected a fourth with 429, and ran the
relay with `DRY=1` against one queued claim. All three were closed as failed; the queue
was empty afterward. This consumes this machine's three-claim quota for 2026-10-13 UTC.
