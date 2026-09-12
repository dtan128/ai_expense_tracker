import { createHmac, timingSafeEqual } from "crypto";
import type { IncomingMessage } from "http";

// Dashboard sessions are a single shared passcode (this is a single-user app),
// not per-user accounts. The session cookie is a self-verifying signed token
// (expiry + HMAC), so there's no session table or DB lookup on every request.

export const COOKIE_NAME = "expenses_session";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Missing SESSION_SECRET environment variable.");
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

/** Creates a `${expiresAtMs}.${hmacSignature}` token. No DB lookup needed to verify it. */
export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return `${expiresAt}.${sign(String(expiresAt))}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresAtStr, sig] = token.split(".");
  if (!expiresAtStr || !sig) return false;

  const expected = sign(expiresAtStr);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  return Number(expiresAtStr) > Date.now();
}

/** Constant-time-ish comparison against the shared dashboard passcode. */
export function checkPasscode(input: string): boolean {
  const real = process.env.DASHBOARD_PASSCODE;
  if (!real) throw new Error("Missing DASHBOARD_PASSCODE environment variable.");
  const a = Buffer.from(input);
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  });
  return out;
}

export function isAuthenticated(req: IncomingMessage): boolean {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

export function sessionCookieHeader(): string {
  const token = createSessionToken();
  // Skip Secure in dev so it still works over plain http://localhost.
  const secureFlag = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; SameSite=Lax;${secureFlag}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}
