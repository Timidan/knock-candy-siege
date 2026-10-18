-- Counters, updated as events arrive. kind 'total' holds the fixed totals (players, runners, runs_started,
-- runs_finished, wins, quits, play_seconds, stars, kills, bosses, grants, purchases); 'day' holds unique
-- players per UTC day (key 2026-10-13); 'kill', 'boss', 'hero', 'level', 'purchase', 'ref' (referring host
-- per visit) and 'device' (phone, tablet or desktop per visit) hold one row per name.
CREATE TABLE IF NOT EXISTS tallies (
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (kind, key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS tallies_top ON tallies(kind, n DESC);

-- One row per anonymous browser id and the last UTC day it sent anything (for the 7-day unique count).
CREATE TABLE IF NOT EXISTS players (
  pid TEXT PRIMARY KEY,
  last_day TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS players_last_day ON players(last_day);

-- One row per browser id that started at least one level (counted from 2026-10-15). The Worker also creates it on first use.
CREATE TABLE IF NOT EXISTS runners (
  pid TEXT PRIMARY KEY
) WITHOUT ROWID;

-- Rate-limit counters. bucket is a UTC hour (2026-10-13T09) or day; key is ip:<hash>, pid:<uuid> or new:<hash>.
-- Buckets from earlier days are deleted when the day's salt is created.
CREATE TABLE IF NOT EXISTS hits (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (bucket, key)
) WITHOUT ROWID;

-- One random salt per UTC day for hashing IPs. Earlier salts are deleted, so old hashes cannot be traced to an IP.
CREATE TABLE IF NOT EXISTS salts (
  day TEXT PRIMARY KEY,
  salt TEXT NOT NULL
);

-- Feedback from the result card. No route reads it; the owner queries it with wrangler (docs/DEVELOPMENT.md).
-- level is 1-6, endless, daily or party-<level>; pid is null when the player turned stats off. The Worker also creates it on first use.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  level TEXT NOT NULL,
  won INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  hero INTEGER NOT NULL,
  device TEXT,
  rating INTEGER,
  text TEXT NOT NULL,
  pid TEXT
);
