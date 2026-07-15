import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * GET /api/auth/google
 * Redirects the browser to Google's OAuth consent screen.
 * Uses an HTML meta-refresh redirect to avoid OpenNext framework issues.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const cfEnv = ctx.env as any;

    const clientId = cfEnv.GOOGLE_CLIENT_ID;
    const origin = new URL(req.url).origin;
    const redirectUri = cfEnv.GOOGLE_REDIRECT_URI ?? `${origin}/api/auth/callback`;

    if (!clientId) {
      return Response.json(
        { error: "GOOGLE_CLIENT_ID not configured", keys: Object.keys(cfEnv) },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
    });

    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${googleUrl}"><script>window.location.href="${googleUrl}";</script></head><body>Redirecting to Google…</body></html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? String(err), stack: err?.stack },
      { status: 500 }
    );
  }
}
