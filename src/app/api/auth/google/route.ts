import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

/**
 * GET /api/auth/google
 * Redirects the browser to Google's OAuth consent screen.
 * Requires GOOGLE_CLIENT_ID + GOOGLE_REDIRECT_URI set as Cloudflare secrets.
 */
export async function GET(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as any;

  const clientId = cfEnv.GOOGLE_CLIENT_ID;
  const redirectUri = cfEnv.GOOGLE_REDIRECT_URI ?? new URL(req.url).origin + "/api/auth/callback";

  if (!clientId) {
    return Response.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}
