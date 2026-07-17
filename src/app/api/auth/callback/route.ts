import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  generateToken,
  generateUserId,
  makeSessionCookie,
  SESSION_TTL_MS,
} from "@/lib/auth";



interface GoogleTokenResponse {
  access_token: string;
  error?: string;
}

interface GoogleUserInfo {
  sub: string;     // Google's unique user ID
  email: string;
  name: string;
  picture: string;
}

/**
 * GET /api/auth/callback
 * Google redirects here with ?code=…  We exchange it for tokens, upsert the user
 * in D1, create a session, and redirect home with an HttpOnly cookie.
 */
export async function GET(req: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as any;
    const db: D1Database = cfEnv.DB;

    const url = new URL(req.url);
    const origin = url.origin;
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response(null, { status: 302, headers: { Location: `${origin}/?auth_error=no_code` } });
    }

    const clientId = cfEnv.GOOGLE_CLIENT_ID;
    const clientSecret = cfEnv.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${origin}/api/auth/callback`;

    if (!clientId || !clientSecret) {
      return Response.json({ error: "Google OAuth not configured" }, { status: 500 });
    }

    // 1. Exchange the auth code for an access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json() as GoogleTokenResponse;
    if (tokenData.error || !tokenData.access_token) {
      return new Response(null, { status: 302, headers: { Location: `${origin}/?auth_error=token_exchange` } });
    }

    // 2. Fetch the user's Google profile
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json() as GoogleUserInfo;

    // 3. Upsert user in D1
    const now = Date.now();
    const existing = await db
      .prepare("SELECT id FROM users WHERE google_id = ?")
      .bind(googleUser.sub)
      .first<{ id: string }>();

    let userId: string;
    if (existing) {
      userId = existing.id;
      // Update name/avatar in case they changed
      await db
        .prepare("UPDATE users SET name = ?, avatar_url = ? WHERE id = ?")
        .bind(googleUser.name, googleUser.picture, userId)
        .run();
    } else {
      userId = generateUserId();
      await db
        .prepare(
          "INSERT INTO users (id, google_id, email, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(userId, googleUser.sub, googleUser.email, googleUser.name, googleUser.picture, now)
        .run();
    }

    // 4. Create a new session token
    const token = generateToken();
    const expiresAt = now + SESSION_TTL_MS;
    await db
      .prepare(
        "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
      )
      .bind(token, userId, expiresAt, now)
      .run();

    // 5. Set cookie and redirect home
    const maxAge = Math.floor(SESSION_TTL_MS / 1000);
    return new Response(null, {
      status: 302,
      headers: {
        Location: origin + "/",
        "Set-Cookie": makeSessionCookie(token, maxAge),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/auth/callback]", err);
    return Response.json(
      { error: "Auth callback failed: " + (err?.message ?? String(err)), stack: err?.stack },
      { status: 500 }
    );
  }
}
