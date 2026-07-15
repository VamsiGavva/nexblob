import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateId, expiryToTimestamp } from "@/lib/json-utils";
import type { Blob } from "@/lib/types";

export const runtime = "edge";

// POST /api/jsonBlob — create new blob
export async function POST(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const body = await req.json() as {
      name?: string;
      content: string;
      expiry?: string;
      workspace_id?: string;
    };

    if (!body.content) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    // Validate JSON
    try {
      JSON.parse(body.content);
    } catch {
      return Response.json({ error: "Invalid JSON content" }, { status: 400 });
    }

    const id = generateId();
    const now = Date.now();
    const expires_at = expiryToTimestamp(body.expiry ?? "never");

    await env.DB
      .prepare(
        `INSERT INTO blobs (id, workspace_id, name, content, ai_chat_history, created_at, updated_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        body.workspace_id ?? null,
        body.name ?? "Untitled",
        body.content,
        "[]",
        now,
        now,
        expires_at
      )
      .run();

    const blob = await env.DB
      .prepare("SELECT * FROM blobs WHERE id = ?")
      .bind(id)
      .first<Blob>();

    return Response.json(blob, {
      status: 201,
      headers: { Location: `/api/jsonBlob/${id}` },
    });
  } catch (err) {
    console.error("[POST /api/jsonBlob]", err);
    return Response.json({ error: "Failed to create blob: " + (err as Error).message }, { status: 500 });
  }
}

// GET /api/jsonBlob — list all blobs (recent 50)
export async function GET(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get("workspace_id");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    let result;
    if (workspace_id) {
      result = await env.DB
        .prepare(
          "SELECT id, name, created_at, updated_at, expires_at FROM blobs WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT ?"
        )
        .bind(workspace_id, limit)
        .all<Blob>();
    } else {
      result = await env.DB
        .prepare(
          "SELECT id, name, created_at, updated_at, expires_at FROM blobs ORDER BY updated_at DESC LIMIT ?"
        )
        .bind(limit)
        .all<Blob>();
    }

    return Response.json({ blobs: result.results });
  } catch (err) {
    console.error("[GET /api/jsonBlob]", err);
    return Response.json({ error: "Failed to list blobs" }, { status: 500 });
  }
}
