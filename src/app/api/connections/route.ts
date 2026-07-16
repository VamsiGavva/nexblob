import { getCloudflareContext } from "@opennextjs/cloudflare";

// GET /api/connections
export async function GET(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as any).DB as D1Database;

    // Read guest cookie for user isolation
    let userId = "";
    const cookieHeader = req.headers.get("Cookie") ?? "";
    for (const part of cookieHeader.split(";")) {
      const [n, ...v] = part.trim().split("=");
      if (n.trim() === "nb_guest") { userId = v.join("=").trim(); break; }
    }
    if (!userId) userId = crypto.randomUUID();

    const result = await db
      .prepare("SELECT id, name, account_id, database_id, created_at FROM d1_connections WHERE user_id = ? ORDER BY created_at DESC")
      .bind(userId)
      .all();

    return Response.json({ connections: result.results });
  } catch (err: any) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

// POST /api/connections
export async function POST(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as any).DB as D1Database;

    // Read or create guest cookie
    let userId = "";
    let newCookie: string | null = null;
    const cookieHeader = req.headers.get("Cookie") ?? "";
    for (const part of cookieHeader.split(";")) {
      const [n, ...v] = part.trim().split("=");
      if (n.trim() === "nb_guest") { userId = v.join("=").trim(); break; }
    }
    if (!userId) {
      userId = crypto.randomUUID();
      newCookie = `nb_guest=${userId}; Path=/; SameSite=Lax; Max-Age=${365 * 24 * 60 * 60}`;
    }

    let body: any;
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

    const { name, account_id, database_id, api_token } = body ?? {};
    if (!name || !account_id || !database_id || !api_token) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare("INSERT INTO d1_connections (id, user_id, name, account_id, database_id, api_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, userId, name, account_id, database_id, api_token, now)
      .run();

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (newCookie) headers["Set-Cookie"] = newCookie;
    return new Response(JSON.stringify({ id, name, account_id, database_id, created_at: now }), { status: 201, headers });
  } catch (err: any) {
    return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
