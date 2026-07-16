import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  generateToken,
  generateUserId,
  makeSessionCookie,
  SESSION_TTL_MS,
} from "@/lib/auth";

/**
 * GET /api/auth/dev-login
 * Backdoor route to log in as any user in local development without Google OAuth.
 */
export async function GET(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db: D1Database = (env as any).DB;

    const url = new URL(req.url);
    const email = url.searchParams.get("email") || "vamsi@marensolutions.com";
    const name = url.searchParams.get("name") || "Vamsi Maren";
    const origin = url.origin;

    const now = Date.now();
    const googleId = `dev_google_${email.replace(/[@.]/g, "_")}`;

    // 1. Upsert user in D1
    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();

    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      userId = generateUserId();
      await db
        .prepare(
          "INSERT INTO users (id, google_id, email, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(userId, googleId, email, name, "https://lh3.googleusercontent.com/a/default-user", now)
        .run();
    }

    // 2. Create session token
    const token = generateToken();
    const expiresAt = now + SESSION_TTL_MS;
    await db
      .prepare(
        "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
      )
      .bind(token, userId, expiresAt, now)
      .run();

    // 3. Set cookie and redirect home
    const maxAge = Math.floor(SESSION_TTL_MS / 1000);
    return new Response(null, {
      status: 302,
      headers: {
        Location: origin + "/",
        "Set-Cookie": makeSessionCookie(token, maxAge),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/auth/dev-login]", err);
    return Response.json(
      { error: "Dev login failed: " + (err?.message ?? String(err)) },
      { status: 500 }
    );
  }
}
