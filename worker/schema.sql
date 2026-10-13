CREATE TABLE IF NOT EXISTS claims (
  address TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('queued', 'paid', 'failed')),
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  tx TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS claims_ip_day ON claims(ip_hash, day);
CREATE INDEX IF NOT EXISTS claims_queue ON claims(state, created_at);
-- Added 2026-10-13: the daily grant cap counts today's claims, and IPs are hashed with a random salt per UTC day.
-- Earlier salts are deleted and earlier days' ip_hash values cleared when a new day's salt is made.
CREATE INDEX IF NOT EXISTS claims_day ON claims(day);
CREATE TABLE IF NOT EXISTS salts (
  day TEXT PRIMARY KEY,
  salt TEXT NOT NULL
);
