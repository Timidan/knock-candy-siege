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
