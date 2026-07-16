import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionToken, getSessionUser } from "@/lib/auth";

function resolveGuestId(req: Request): string {
  const cookieHeader = req.headers.get("Cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name.trim() === "nb_guest") {
      const val = rest.join("=").trim();
      if (val && val.length === 36) return val;
    }
  }
  return crypto.randomUUID();
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveUserId(req: Request, db: D1Database): Promise<string> {
  const token = getSessionToken(req);
  if (token) {
    try {
      const user = await getSessionUser(db, token);
      if (user) return user.id;
    } catch { /* fall through */ }
  }
  return resolveGuestId(req);
}

export async function DELETE(
  req: Request,
  { params }: RouteContext
) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const userId = await resolveUserId(req, (env as any).DB);
    const { id } = await params;

    // Verify ownership
    const connection = await env.DB
      .prepare("SELECT id FROM d1_connections WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .first();

    if (!connection) {
      return Response.json({ error: "Connection not found" }, { status: 404 });
    }

    await env.DB
      .prepare("DELETE FROM d1_connections WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/connections/[id]]", err);
    return Response.json({ error: "Failed to delete connection: " + (err as Error).message }, { status: 500 });
  }
}
