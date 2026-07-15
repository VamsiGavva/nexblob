import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

// GET /api/tables — list all user tables in D1 database
export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    
    // Query sqlite_master to find all user-created tables
    const result = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
      .all<{ name: string }>();

    return Response.json({ tables: result.results.map((r) => r.name) });
  } catch (err) {
    console.error("[GET /api/tables]", err);
    return Response.json({ error: "Failed to list tables: " + (err as Error).message }, { status: 500 });
  }
}
