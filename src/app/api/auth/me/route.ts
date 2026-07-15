import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getSessionToken,
  getSessionUser,
  makeSessionCookie,
} from "@/lib/auth";

export const runtime = "edge";

/** GET /api/auth/me — returns current user or 401 */
export async function GET(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const token = getSessionToken(req);
    if (!token) return Response.json({ user: null }, { status: 200 });

    const user = await getSessionUser((env as any).DB, token);
    return Response.json({ user });
  } catch (err) {
    return Response.json({ user: null, error: (err as Error).message });
  }
}

/** POST /api/auth/logout — clears the session cookie */
export async function POST(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const token = getSessionToken(req);
    if (token) {
      await (env as any).DB
        .prepare("DELETE FROM sessions WHERE token = ?")
        .bind(token)
        .run();
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Expire the cookie immediately
        "Set-Cookie": makeSessionCookie("", 0),
      },
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
