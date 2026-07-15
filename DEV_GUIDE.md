# NexBlob — Developer Guide

> How to run, what each API endpoint does, and example requests/responses.

---

## Running Locally

### Option 1 — Fast iteration (recommended for UI work)

```bash
cd /home/maren/Documents/Self/NexBlob/nexblob
npm run dev
```

- Starts the standard **Next.js dev server** on `http://localhost:3000`
- Hot-reload, fast refresh
- D1 database **not available** — app uses sample data (E-commerce Orders, App Config, Users Dataset)
- Use this when you're working on UI, layout, or components

---

### Option 2 — Full Cloudflare environment (real D1)

```bash
cd /home/maren/Documents/Self/NexBlob/nexblob
npx wrangler dev
```

- Runs the app inside the **workerd runtime** on `http://localhost:8787`
- **Real D1 database** binding available — all API routes work
- Use this when testing blob storage, SQL queries, or AI routes
- Requires wrangler to be logged in (`npx wrangler login`)

---

### Deploy to Production

```bash
npm run deploy
```

Builds with OpenNext + deploys to Cloudflare Workers.  
Live URL: **`https://nexblob.vamsi.workers.dev`**

---

### Preview before deploy

```bash
npm run preview
```

Builds and runs locally in workerd (exact production replica) — good for final QA before deploying.

---

## Environment Variables

### Local (`.env.local` or `.dev.vars` file)

```
GEMINI_API_KEY=AQ.Ab8RN6...
```

Used when running `npm run dev` (local Next.js) or `npx wrangler dev` (workerd dev server).

### Production secrets

```bash
npx wrangler secret put GEMINI_API_KEY
# Paste your Gemini key when prompted
```

> **AI features (Explain, TypeScript, SQL, Sample data) will silently degrade** if the key is missing — they return a helpful "not configured" message instead of crashing.

---

## Database Commands

| Task | Command |
|------|---------|
| Apply migration to **local** D1 | `npx wrangler d1 migrations apply nexblob --local` |
| Apply migration to **production** D1 | `npx wrangler d1 migrations apply nexblob --remote` |
| Create a new migration file | `npx wrangler d1 migrations create nexblob <name>` |
| Query production D1 manually | `npx wrangler d1 execute nexblob --remote --command="SELECT * FROM blobs LIMIT 5"` |
| Query local D1 manually | `npx wrangler d1 execute nexblob --command="SELECT * FROM blobs LIMIT 5"` |
| Regenerate TypeScript types after wrangler.jsonc change | `npm run cf-typegen` |

---

## API Endpoints

All routes use `export const runtime = "edge"` and access D1 via `getCloudflareContext().env.DB`.

Base URL (production): `https://nexblob.vamsi.workers.dev`  
Base URL (local wrangler): `http://localhost:8787`

---

### `POST /api/jsonBlob`

**What it does:** Creates a new JSON blob and stores it in D1.

**Request body:**
```json
{
  "content": "{\"hello\": \"world\"}",
  "name": "My first blob",
  "expiry": "never",
  "workspace_id": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | ✅ | JSON string to store. Must be valid JSON. |
| `name` | string | ❌ | Display name (default: `"Untitled"`) |
| `expiry` | `"never"` \| `"30d"` \| `"75d"` | ❌ | How long before the blob expires (default: `"never"`) |
| `workspace_id` | string \| null | ❌ | Group blobs under a workspace |

**Response `201 Created`:**
```json
{
  "id": "Ab3Kx9mZqRwLpV7nY2cDe",
  "workspace_id": null,
  "name": "My first blob",
  "content": "{\"hello\": \"world\"}",
  "created_at": 1752496800000,
  "updated_at": 1752496800000,
  "expires_at": null
}
```

Headers returned: `Location: /api/jsonBlob/Ab3Kx9mZqRwLpV7nY2cDe`

**Errors:**
- `400` — `content` missing or not valid JSON
- `500` — D1 write failure

**cURL example:**
```bash
curl -X POST https://nexblob.vamsi.workers.dev/api/jsonBlob \
  -H "Content-Type: application/json" \
  -d '{"content":"{\"key\":\"value\"}","name":"Test","expiry":"30d"}'
```

---

### `GET /api/jsonBlob`

**What it does:** Lists recent blobs (up to 100), ordered by `updated_at DESC`.

**Query params:**

| Param | Description |
|-------|-------------|
| `workspace_id` | Filter by workspace (optional) |
| `limit` | Max rows to return (default: 50, max: 100) |

**Response `200 OK`:**
```json
{
  "blobs": [
    {
      "id": "Ab3Kx9mZqRwLpV7nY2cDe",
      "name": "My first blob",
      "created_at": 1752496800000,
      "updated_at": 1752496800000,
      "expires_at": null
    }
  ]
}
```

> Note: Does not return `content` field — fetch individual blob for full content.

**cURL example:**
```bash
curl "https://nexblob.vamsi.workers.dev/api/jsonBlob?limit=10"
```

---

### `GET /api/jsonBlob/:id`

**What it does:** Fetches a single blob including its full JSON content.

**URL param:** `:id` — the blob's ID string

**Response `200 OK`:**
```json
{
  "id": "Ab3Kx9mZqRwLpV7nY2cDe",
  "workspace_id": null,
  "name": "My first blob",
  "content": "{\"key\":\"value\"}",
  "created_at": 1752496800000,
  "updated_at": 1752496800000,
  "expires_at": null
}
```

**Errors:**
- `404` — Blob ID not found
- `410 Gone` — Blob exists but has passed its `expires_at` timestamp

**cURL example:**
```bash
curl https://nexblob.vamsi.workers.dev/api/jsonBlob/Ab3Kx9mZqRwLpV7nY2cDe
```

---

### `PUT /api/jsonBlob/:id`

**What it does:** Updates a blob's content and/or name.  
**Automatically saves a version snapshot** of the previous content before overwriting.

**Request body:**
```json
{
  "content": "{\"updated\": true}",
  "name": "Renamed blob"
}
```

> Both fields are optional — send either one or both.

**Response `200 OK`:** Returns the updated blob object (same shape as GET).

**Side effect:** The old `content` is saved to the `versions` table with a timestamp.

**Errors:**
- `400` — Neither `content` nor `name` provided, or invalid JSON
- `404` — Blob not found
- `500` — D1 write failure

**cURL example:**
```bash
curl -X PUT https://nexblob.vamsi.workers.dev/api/jsonBlob/Ab3Kx9mZqRwLpV7nY2cDe \
  -H "Content-Type: application/json" \
  -d '{"content":"{\"updated\":true}","name":"Updated blob"}'
```

---

### `DELETE /api/jsonBlob/:id`

**What it does:** Permanently deletes a blob. Cascades to its `comments` and `versions` records via `ON DELETE CASCADE`.

**Response `204 No Content`** (empty body on success)

**Errors:**
- `404` — Blob not found
- `500` — D1 delete failure

**cURL example:**
```bash
curl -X DELETE https://nexblob.vamsi.workers.dev/api/jsonBlob/Ab3Kx9mZqRwLpV7nY2cDe
```

---

### `GET /api/tables/:table`

**What it does:** Queries a **real D1 table** (not blob storage) and returns its rows as JSON. Used by the "Connect database" feature to expose your own D1 tables in Table view and SQL view.

**URL param:** `:table` — table name (alphanumeric + underscores only; validated with regex)

**Query params:**

| Param | Description |
|-------|-------------|
| `limit` | Rows per page (default: 100, max: 500) |
| `offset` | Row offset for pagination (default: 0) |

**Response `200 OK`:**
```json
{
  "table": "blobs",
  "rows": [
    { "id": "abc", "name": "Test", "content": "{}", "created_at": 1752496800000 }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

**Errors:**
- `400` — Table name contains invalid characters (prevents SQL injection)
- `500` — Table does not exist or D1 query failed

**cURL example:**
```bash
curl "https://nexblob.vamsi.workers.dev/api/tables/blobs?limit=10&offset=0"
```

> **Security note:** Only tables that exist in your D1 database are accessible. The table name is validated with `/^[a-zA-Z_][a-zA-Z0-9_]*$/` before the query runs.

---

### `POST /api/ai`

**What it does:** Sends the active blob's JSON content to **Google Gemini gemini-3.5-flash** and returns a structured AI response. Requires `GEMINI_API_KEY` to be set.

**Request body:**

```json
{
  "action": "explain",
  "content": "{\"orders\": [{\"id\": 1, \"status\": \"shipped\"}]}"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | ✅ | One of: `"explain"`, `"typescript" | `"sql"`, `"sample"` |
| `content` | string | ✅ | The raw JSON string to analyze |

**Actions explained:**

| Action | What Gemini does |
|--------|-----------------|
| `explain` | Plain-language summary of what the JSON represents, its structure, key fields, and patterns |
| `typescript` | Generates TypeScript interfaces with JSDoc comments and proper optional types |
| `sql` | Produces `CREATE TABLE` DDL and sample `INSERT` statements (SQLite-compatible) |
| `sample` | Generates 5 new realistic rows matching the JSON's schema |

**Response `200 OK`:**
```json
{
  "result": "This JSON represents an e-commerce orders array with 5 records. Each order has an id (integer), customer name (string), status field (string — values: shipped, pending, delivered, cancelled), total price (float), item count (integer), and ISO timestamp..."
}
```

**Response when API key is not configured:**
```json
{
  "result": "[AI not configured] Add GEMINI_API_KEY to your .env.local file to enable AI features.\n\nAction: explain\nContent preview: {\"orders\":..."
}
```

**Errors:**
- `400` — Unknown `action` value
- `500` — Gemini API returned an error


**cURL example:**
```bash
curl -X POST https://nexblob.vamsi.workers.dev/api/ai \
  -H "Content-Type: application/json" \
  -d '{
    "action": "typescript",
    "content": "[{\"id\":1,\"name\":\"Alice\",\"active\":true}]"
  }'
```

**Example TypeScript output:**
```typescript
/** Represents a single user record */
export interface User {
  /** Unique identifier */
  id: number;
  /** Display name */
  name: string;
  /** Whether the user is active */
  active: boolean;
}

export type Users = User[];
```

---

## API Response Codes Summary

| Code | Meaning |
|------|---------|
| `200` | Success with body |
| `201` | Created (blob created via POST) |
| `204` | Success, no body (DELETE) |
| `400` | Bad request — invalid input or JSON |
| `404` | Resource not found |
| `410` | Gone — blob has expired |
| `500` | Server/D1 error |

---

## D1 Tables Reference

| Table | Purpose |
|-------|---------|
| `blobs` | Core blob storage — id, name, content, expiry |
| `comments` | (Phase 3) Comments anchored to JSON paths |
| `versions` | Auto-saved snapshots on every PUT — used for version history |

---

## Quick Reference — All Commands

```bash
# Development
npm run dev                          # Next.js dev server (no D1)
npx wrangler dev                     # workerd dev server (real D1)

# Deploy
npm run deploy                       # Build + deploy to Cloudflare
npm run preview                      # Build + run locally in workerd

# Database
npx wrangler d1 migrations apply nexblob --local    # Apply migrations locally
npx wrangler d1 migrations apply nexblob --remote   # Apply migrations to production

# Secrets
npx wrangler secret put GEMINI_API_KEY               # Set AI key in production

# Types
npm run cf-typegen                   # Regenerate Cloudflare binding types
```
