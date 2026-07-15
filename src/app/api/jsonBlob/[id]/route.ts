import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateId } from "@/lib/json-utils";
import { getSessionToken, getSessionUser } from "@/lib/auth";
import type { Blob, Version } from "@/lib/types";



interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/jsonBlob/:id
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const { id } = await params;

    const blob = await env.DB
      .prepare("SELECT * FROM blobs WHERE id = ?")
      .bind(id)
      .first<Blob>();

    if (!blob) {
      return Response.json({ error: "Blob not found" }, { status: 404 });
    }

    // Check expiry
    if (blob.expires_at && blob.expires_at < Date.now()) {
      return Response.json({ error: "Blob has expired" }, { status: 410 });
    }

    return Response.json(blob);
  } catch (err) {
    console.error("[GET /api/jsonBlob/:id]", err);
    return Response.json({ error: "Failed to fetch blob" }, { status: 500 });
  }
}

// PUT /api/jsonBlob/:id — replace content, save version
export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const { env } = await getCloudflareContext({ async: true });

    // Auth guard: must be logged in to save
    const token = getSessionToken(req);
    const user = token ? await getSessionUser((env as any).DB, token) : null;
    if (!user) {
      return Response.json({ error: "Unauthorized: please sign in to save" }, { status: 401 });
    }

    const { id } = await params;

    const body = await req.json() as {
      content?: string;
      name?: string;
      ai_chat_history?: string;
    };

    if (!body.content && !body.name && body.ai_chat_history === undefined) {
      return Response.json({ error: "content, name or ai_chat_history is required" }, { status: 400 });
    }

    if (body.content) {
      try {
        JSON.parse(body.content);
      } catch {
        return Response.json({ error: "Invalid JSON content" }, { status: 400 });
      }
    }

    const existing = await env.DB
      .prepare("SELECT * FROM blobs WHERE id = ?")
      .bind(id)
      .first<Blob>();

    const now = Date.now();

    if (!existing) {
      // Upsert: Insert new blob since it doesn't exist in the database (e.g. sample blobs)
      await env.DB
        .prepare(
          `INSERT INTO blobs (id, workspace_id, name, content, ai_chat_history, created_at, updated_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          null,
          body.name ?? "Untitled",
          body.content ?? "{}",
          body.ai_chat_history ?? "[]",
          now,
          now,
          null
        )
        .run();
    } else {
      if (body.content) {
        // Save version before update
        const versionId = generateId();
        await env.DB
          .prepare(
            "INSERT INTO versions (id, blob_id, content, created_at) VALUES (?, ?, ?, ?)"
          )
          .bind(versionId, id, existing.content, now)
          .run();
      }

      await env.DB
        .prepare(
          `UPDATE blobs SET
             content = COALESCE(?, content),
             name = COALESCE(?, name),
             ai_chat_history = COALESCE(?, ai_chat_history),
             updated_at = ?
           WHERE id = ?`
        )
        .bind(body.content ?? null, body.name ?? null, body.ai_chat_history ?? null, now, id)
        .run();
    }

    const updated = await env.DB
      .prepare("SELECT * FROM blobs WHERE id = ?")
      .bind(id)
      .first<Blob>();

    return Response.json(updated);
  } catch (err) {
    console.error("[PUT /api/jsonBlob/:id]", err);
    return Response.json({ error: "Failed to update blob: " + (err as Error).message }, { status: 500 });
  }
}


// DELETE /api/jsonBlob/:id
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const { id } = await params;

    const existing = await env.DB
      .prepare("SELECT id FROM blobs WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) {
      return Response.json({ error: "Blob not found" }, { status: 404 });
    }

    await env.DB.prepare("DELETE FROM blobs WHERE id = ?").bind(id).run();

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/jsonBlob/:id]", err);
    return Response.json({ error: "Failed to delete blob" }, { status: 500 });
  }
}

// GET /api/jsonBlob/:id/versions
export { getVersions };

async function getVersions(id: string) {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB
    .prepare("SELECT * FROM versions WHERE blob_id = ? ORDER BY created_at DESC LIMIT 20")
    .bind(id)
    .all<Version>();
}
