# Siege Stats

Live: https://siege-stats.timidan-knock.workers.dev

One Worker and one D1 database (`siege-stats`) that count anonymous play for the public page at
`/stats` (`app/src/stats/StatsPage.tsx`). No secrets. Flow: game (`app/src/siege/telemetry.ts`) →
`POST /event` → counters in D1 → `GET /stats` → stats page.

| Route | Request | Response |
| --- | --- | --- |
| `POST /event` | JSON `{pid, type, ...}`, at most 4 KB, any content type (the game sends `text/plain`, so no preflight) | `204`; `400` invalid, `413` too large, `429` rate limit, `503` D1 unavailable |
| `GET /stats` | none | the aggregates below, `Cache-Control: public, max-age=30`; `429` rate limit |

Event types (`pid` is a lowercase v4 UUID made in the browser):

| `type` | Fields | Counts |
| --- | --- | --- |
| `session` | none | the player (any event does) |
| `run_start` | `level` (`1`–`6`, `endless`, `daily`), `hero` (Chog id 1–1969) | runs started, runs per level, runs per hero |
| `run_end` | `level`, `hero`, `won`, `quit`, `stars`, `score`, `durationS`, `wavesCleared`, `killsByKind`, `bossesDefeated` | finished (win or loss) or quit, wins, stars, play time, kills per kind, bosses per id |
| `grant` | none | starter grants paid |
| `purchase` | `item` (shop item id) | purchases, per item |

Validation, at this trust boundary: names (`level`, kill kinds, boss ids, `item`) must match
`^[a-z0-9-]{1,32}$`. A bad `pid`, `type`, `level`, `hero` or `item` rejects the event. Inside a run, bad
kind or boss names are dropped and numbers are clamped. A kind counts at most 3,000 kills, and at most 60
kinds and 60 bosses are read. `durationS` is at most 7,200 and stars 0–3, counted only for a win. A run
holding more than 5,000 kills is scaled down to 5,000 (no level has more than ~520 enemies). `score` and
`wavesCleared` are accepted but not stored; nothing shows them yet.

A Workers Rate Limiting binding (`LIMITER`, 30 requests per minute per IP and route, per Cloudflare location) runs
before D1 on both routes. It is approximate: short bursts can pass two to three times that before `429`s start.
D1 limits, read before any write so a rejected event writes nothing: 120 events per IP per UTC hour, 60 per browser id per hour, and 30 new browser ids per IP
per UTC day, so a script cannot invent many "players". IPs are hashed with SHA-256 and a random salt
for each UTC day, kept in D1. Raw IPs are never stored. When a new day's salt is made, the old salt and
the earlier rate-limit rows are deleted, so old hashes cannot be traced back to an IP.

`GET /stats` returns:

```json
{ "generatedAt": "ISO time", "reported": true,
  "players": { "allTime": 0, "today": 0, "last7Days": 0, "daily": [{ "day": "2026-10-13", "players": 0 }] },
  "runs": { "started": 0, "finished": 0, "wins": 0, "quits": 0, "playSeconds": 0 },
  "kills": { "total": 0, "byKind": [{ "kind": "skeleton", "n": 0 }] },
  "bosses": { "total": 0, "byName": [{ "name": "pumpkin", "n": 0 }] },
  "heroes": [{ "id": 1481, "runs": 0 }], "levels": [{ "level": "1", "runs": 0 }],
  "stars": 0, "grants": 0, "purchases": { "total": 0, "byItem": [{ "item": "21", "n": 0 }] } }
```

`daily` always has 14 UTC days, oldest first. Lists are sorted by count: the top 10 heroes, 20 levels,
30 bosses or items, and 60 kinds. "Finished" means a win or a loss. A quit (leaving a loaded run before
it ends) is counted separately. Its kills and play time still count.

Schema (`schema.sql`): `tallies(kind, key, n)` holds every counter: kind `total`, `day`, `kill`,
`boss`, `hero`, `level` or `purchase`, with a `(kind, n DESC)` index for top lists. Each event is a
handful of upserts, whatever the number of kinds. `players(pid, last_day)` gives the 7-day unique
count through an index on `last_day`. New players and each day's uniques are counted inside the event's
write transaction (guarded by `NOT EXISTS` on `players`), so simultaneous events from one new id count it once. `hits(bucket, key, n)` holds rate limits and `salts(day, salt)`
the IP salts. A `/stats` read touches at most ~180 counter rows plus one index entry per player active
in the last 7 days. Each Worker isolate recomputes it at most every 30 seconds, concurrent requests share one D1 read, and it serves the
last good result if D1 fails. Each Cloudflare location also keeps the response for 30 seconds in `caches.default`.
`reported: true` marks every number as an anonymous client report: the Worker checks shape and rate, not gameplay or payment.

CORS: `https://knock.timidan.xyz`, `https://knock-ej6.pages.dev` and its preview subdomains, and
`http://localhost:*`. Other browser origins get `403`. Requests with no `Origin` (curl) are allowed.

Deploy from this directory with `npm install` (or the cached `npx wrangler`), then `npx wrangler deploy`.
`schema.sql` is already applied remotely (`npx wrangler d1 execute siege-stats --remote --file schema.sql`).
To reset the public numbers: `npx wrangler d1 execute siege-stats --remote --command "DELETE FROM tallies; DELETE FROM players; DELETE FROM hits; DELETE FROM salts"`.
