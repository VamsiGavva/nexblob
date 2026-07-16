import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionToken, getSessionUser } from "@/lib/auth";

export const runtime = "edge";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
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
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
      }),
    });

    const cfData = await cfRes.json() as any;
    if (!cfRes.ok || !cfData.success) {
      const errorMsg = cfData.errors?.[0]?.message || "Cloudflare API request failed";
      return Response.json({ error: errorMsg }, { status: cfRes.status });
    }

    const resultsArray = cfData.result?.[0]?.results || [];
    const tables = resultsArray.map((r: any) => r.name);

    return Response.json({ tables });
  } catch (err) {
    console.error("[GET /api/connections/[id]/tables]", err);
    return Response.json({ error: "Failed to list tables: " + (err as Error).message }, { status: 500 });
  }
}
