-- Migration: 0003_d1_connections
CREATE TABLE IF NOT EXISTS d1_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  api_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_d1_connections_user ON d1_connections(user_id);
