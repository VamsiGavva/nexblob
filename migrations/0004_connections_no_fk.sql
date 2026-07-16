-- Migration: 0004_connections_no_fk
-- Recreate d1_connections without the FK constraint so guest users (no session) can save connections
CREATE TABLE IF NOT EXISTS d1_connections_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  api_token TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

INSERT INTO d1_connections_v2 SELECT * FROM d1_connections;

DROP TABLE d1_connections;

ALTER TABLE d1_connections_v2 RENAME TO d1_connections;

CREATE INDEX IF NOT EXISTS idx_d1_connections_user ON d1_connections(user_id);
