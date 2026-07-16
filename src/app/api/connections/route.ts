import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionToken, getSessionUser } from "@/lib/auth";

export const runtime = "edge";

// GET /api/connections — list D1 connections for current user
export async function GET(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const token = getSessionToken(req);
    const user = token ? await getSessionUser((env as any).DB, token) : null;
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await env.DB
      .prepare("SELECT id, name, account_id, database_id, created_at FROM d1_connections WHERE user_id = ? ORDER BY created_at DESC")
      .bind(user.id)
      .all();

    return Response.json({ connections: result.results });
  } catch (err) {
    console.error("[GET /api/connections]", err);
    return Response.json({ error: "Failed to list connections: " + (err as Error).message }, { status: 500 });
  }
}

// POST /api/connections — add a new D1 connection
export async function POST(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const token = getSessionToken(req);
    const user = token ? await getSessionUser((env as any).DB, token) : null;
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, account_id, database_id, api_token } = await req.json() as {
      name?: string;
      account_id?: string;
      database_id?: string;
      api_token?: string;
    };

    if (!name || !account_id || !database_id || !api_token) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await env.DB
      .prepare(
        `INSERT INTO d1_connections (id, user_id, name, account_id, database_id, api_token, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, user.id, name, account_id, database_id, api_token, now)
      .run();

    return Response.json({
      id,
      name,
      account_id,
      database_id,
      created_at: now
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/connections]", err);
    return Response.json({ error: "Failed to add connection: " + (err as Error).message }, { status: 500 });
  }
}
