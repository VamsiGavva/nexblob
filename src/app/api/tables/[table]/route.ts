import { getCloudflareContext } from "@opennextjs/cloudflare";



interface RouteContext {
  params: Promise<{ table: string }>;
}

// GET /api/tables/:table — query a real D1 table as JSON
export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const { table } = await params;

    // Validate table name (alphanumeric + underscores only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      return Response.json({ error: "Invalid table name" }, { status: 400 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const [rows, countResult] = await Promise.all([
      env.DB.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
        .bind(limit, offset)
        .all(),
      env.DB.prepare(`SELECT COUNT(*) as total FROM "${table}"`).first<{ total: number }>(),
    ]);

    return Response.json({
      table,
      rows: rows.results,
      total: countResult?.total ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[GET /api/tables/:table]", err);
    return Response.json({ error: "Failed to query table: " + (err as Error).message }, { status: 500 });
  }
}

// GET /api/tables — list all user tables in D1
export { listTables };

async function listTables() {
  const { env } = await getCloudflareContext({ async: true });
  const result = await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
    .all<{ name: string }>();
  return result.results.map((r) => r.name);
}
