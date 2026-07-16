import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionToken, getSessionUser } from "@/lib/auth";

export const runtime = "edge";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: Request,
  { params }: RouteContext
) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const token = getSessionToken(req);
    const user = token ? await getSessionUser((env as any).DB, token) : null;
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { sql, params: queryParams } = await req.json() as {
      sql: string;
      params?: any[];
    };

    if (!sql) {
      return Response.json({ error: "SQL query is required" }, { status: 400 });
    }

    // Fetch connection details from DB
    const conn = await env.DB
      .prepare("SELECT account_id, database_id, api_token FROM d1_connections WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first<{ account_id: string; database_id: string; api_token: string }>();

    if (!conn) {
      return Response.json({ error: "Connection not found" }, { status: 404 });
    }

    const queryUrl = `https://api.cloudflare.com/client/v4/accounts/${conn.account_id}/d1/database/${conn.database_id}/query`;
    const cfRes = await fetch(queryUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.api_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        params: queryParams || [],
      }),
    });

    const cfData = await cfRes.json() as any;
    if (!cfRes.ok || !cfData.success) {
      const errorMsg = cfData.errors?.[0]?.message || "Cloudflare API query failed";
      return Response.json({ error: errorMsg }, { status: cfRes.status });
    }

    const results = cfData.result?.[0]?.results || [];
    return Response.json({ rows: results });
  } catch (err) {
    console.error("[POST /api/connections/[id]/query]", err);
    return Response.json({ error: "Failed to query database: " + (err as Error).message }, { status: 500 });
  }
}
