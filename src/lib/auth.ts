/**
 * Auth utilities — session management using D1.
 * Sessions live for 30 days. Token is a 64-char hex string stored in an HttpOnly cookie.
 */

export const SESSION_COOKIE = "nb_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

/** Generate a cryptographically-random session token */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a short unique user ID */
export function generateUserId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Read the session token from the Cookie header */
export function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name.trim() === SESSION_COOKIE) return rest.join("=").trim();
  }
  return null;
}

/** Set a session cookie header value */
export function makeSessionCookie(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/** Look up a valid (non-expired) session and return the associated user. Returns null if invalid. */
export async function getSessionUser(
  db: D1Database,
  token: string
): Promise<SessionUser | null> {
  const now = Date.now();
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.avatar_url
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .bind(token, now)
    .first<SessionUser>();
  return row ?? null;
}
