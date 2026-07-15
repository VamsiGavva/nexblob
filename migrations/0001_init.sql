-- NexBlob D1 Schema
-- Migration: 0001_init

CREATE TABLE IF NOT EXISTS blobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  name TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  blob_id TEXT NOT NULL,
  path TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (blob_id) REFERENCES blobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  blob_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (blob_id) REFERENCES blobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_blobs_workspace ON blobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_blobs_updated ON blobs(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_blob ON comments(blob_id);
CREATE INDEX IF NOT EXISTS idx_versions_blob ON versions(blob_id);
