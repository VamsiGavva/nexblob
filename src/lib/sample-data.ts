import type { Blob } from "./types";

export const SAMPLE_BLOBS: Blob[] = [
  {
    id: "sample_ecommerce_01",
    workspace_id: null,
    name: "E-commerce Orders",
    content: JSON.stringify(
      [
        { id: 1001, customer: "Alice Chen", status: "shipped", total: 129.99, items: 3, created_at: "2026-07-10T08:30:00Z" },
        { id: 1002, customer: "Bob Ramos", status: "pending", total: 49.5, items: 1, created_at: "2026-07-11T14:22:00Z" },
        { id: 1003, customer: "Carol Singh", status: "delivered", total: 289.0, items: 5, created_at: "2026-07-12T09:15:00Z" },
        { id: 1004, customer: "Dave Kim", status: "cancelled", total: 75.25, items: 2, created_at: "2026-07-13T16:45:00Z" },
        { id: 1005, customer: "Eve Müller", status: "shipped", total: 199.99, items: 4, created_at: "2026-07-14T10:00:00Z" },
      ],
      null,
      2
    ),
    created_at: Date.now() - 86400000,
    updated_at: Date.now() - 3600000,
    expires_at: null,
  },
  {
    id: "sample_config_02",
    workspace_id: null,
    name: "App Config",
    content: JSON.stringify(
      {
        app: {
          name: "NexBlob",
          version: "1.0.0",
          debug: false,
          features: { ai: true, collab: false, charts: true },
        },
        database: {
          provider: "cloudflare-d1",
          name: "nexblob",
          maxConnections: 10,
        },
        limits: { maxBlobSize: 1048576, maxBlobs: 100, retention: "75d" },
      },
      null,
      2
    ),
    created_at: Date.now() - 172800000,
    updated_at: Date.now() - 7200000,
    expires_at: null,
  },
  {
    id: "sample_users_03",
    workspace_id: null,
    name: "Users Dataset",
    content: JSON.stringify(
      [
        { id: 1, name: "Alice Chen", email: "alice@example.com", role: "admin", active: true, score: 98.5 },
        { id: 2, name: "Bob Ramos", email: "bob@example.com", role: "editor", active: true, score: 76.3 },
        { id: 3, name: "Carol Singh", email: "carol@example.com", role: "viewer", active: false, score: 54.1 },
        { id: 4, name: "Dave Kim", email: "dave@example.com", role: "editor", active: true, score: 88.7 },
      ],
      null,
      2
    ),
    created_at: Date.now() - 259200000,
    updated_at: Date.now() - 14400000,
    expires_at: null,
  },
];
