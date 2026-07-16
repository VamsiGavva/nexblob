import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionToken, getSessionUser } from "@/lib/auth";

export const runtime = "edge";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(
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

    // Verify ownership
    const connection = await env.DB
      .prepare("SELECT id FROM d1_connections WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first();

    if (!connection) {
      return Response.json({ error: "Connection not found" }, { status: 404 });
    }

    await env.DB
      .prepare("DELETE FROM d1_connections WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .run();

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/connections/[id]]", err);
    return Response.json({ error: "Failed to delete connection: " + (err as Error).message }, { status: 500 });
  }
}
