import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionToken, getSessionUser } from "@/lib/auth";

export const runtime = "edge";

/** Returns the effective user_id — real user if logged in, else a guest UUID from cookie */
function resolveGuestId(req: Request): { userId: string; newCookieHeader: string | null } {
  const cookieHeader = req.headers.get("Cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name.trim() === "nb_guest") {
      const val = rest.join("=").trim();
      if (val && val.length === 36) return { userId: val, newCookieHeader: null };
    }
  }
  const newId = crypto.randomUUID();
  const cookie = `nb_guest=${newId}; Path=/; SameSite=Lax; Max-Age=${365 * 24 * 60 * 60}`;
  return { userId: newId, newCookieHeader: cookie };
}

async function getEffectiveUserId(req: Request, db: D1Database): Promise<{ userId: string; newCookieHeader: string | null }> {
  const token = getSessionToken(req);
  if (token) {
    try {
      const user = await getSessionUser(db, token);
      if (user) return { userId: user.id, newCookieHeader: null };
    } catch {
      // fall through to guest
    }
  }
  return resolveGuestId(req);
}

// GET /api/connections — list D1 connections for current user (or guest)
export async function GET(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as any).DB as D1Database;
    const { userId, newCookieHeader } = await getEffectiveUserId(req, db);

    const result = await db
      .prepare("SELECT id, name, account_id, database_id, created_at FROM d1_connections WHERE user_id = ? ORDER BY created_at DESC")
      .bind(userId)
      .all();

    const respHeaders: Record<string, string> = {};
    if (newCookieHeader) respHeaders["Set-Cookie"] = newCookieHeader;
    return Response.json({ connections: result.results }, { headers: respHeaders });
  } catch (err) {
    console.error("[GET /api/connections]", err);
    return Response.json({ error: "Failed to list connections: " + (err as Error).message }, { status: 500 });
  }
}

// POST /api/connections — add a new D1 connection (works for guests too)
export async function POST(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as any).DB as D1Database;
    const { userId, newCookieHeader } = await getEffectiveUserId(req, db);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, account_id, database_id, api_token } = body as {
      name?: string;
      account_id?: string;
      database_id?: string;
      api_token?: string;
    };

    if (!name || !account_id || !database_id || !api_token) {
      return Response.json({ error: "Missing required fields: name, account_id, database_id, api_token" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO d1_connections (id, user_id, name, account_id, database_id, api_token, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, name, account_id, database_id, api_token, now)
      .run();

    const respHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (newCookieHeader) respHeaders["Set-Cookie"] = newCookieHeader;

    return new Response(JSON.stringify({ id, name, account_id, database_id, created_at: now }), {
      status: 201,
      headers: respHeaders,
    });
  } catch (err) {
    console.error("[POST /api/connections]", err);
    return Response.json({ error: "Failed to add connection: " + (err as Error).message }, { status: 500 });
  }
}
