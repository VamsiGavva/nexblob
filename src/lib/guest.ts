/**
 * Guest session utilities — allows anonymous users to save D1 connections
 * by assigning them a stable "guest ID" cookie.
 */

export const GUEST_COOKIE = "nb_guest";

/** Read or generate a stable guest ID from the Cookie header */
export function getOrCreateGuestId(request: Request): {
  guestId: string;
  isNew: boolean;
} {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name.trim() === GUEST_COOKIE) {
      const val = rest.join("=").trim();
      if (val && val.length === 36) {
        return { guestId: val, isNew: false };
      }
    }
  }
  return { guestId: crypto.randomUUID(), isNew: true };
}

/** Build Set-Cookie header value for guest ID */
export function makeGuestCookie(guestId: string): string {
  const oneYear = 365 * 24 * 60 * 60;
  return `${GUEST_COOKIE}=${guestId}; Path=/; SameSite=Lax; Max-Age=${oneYear}`;
}
