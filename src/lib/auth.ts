import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

const SESSION_DAYS = 14;

export type SessionPayload = {
  uid: string;
  exp: number;
  supportStoreId?: string;
  supportExp?: number;
};

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set to a string of at least 16 characters.");
  }
  return secret;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function signSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.supportExp && payload.supportExp < Date.now()) {
      delete payload.supportStoreId;
      delete payload.supportExp;
    }
    return payload;
  } catch {
    return null;
  }
}

export function sessionExpiry() {
  return Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
}

export function signWebhook(raw: string, secret = process.env.PAYMENT_WEBHOOK_SECRET || "") {
  if (!secret) throw new Error("PAYMENT_WEBHOOK_SECRET is not set.");
  return createHmac("sha256", secret).update(raw).digest("hex");
}

export function verifyWebhookSignature(raw: string, signature: string | null) {
  if (!signature) return false;
  const expected = signWebhook(raw);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const loginAttempts = new Map<string, { count: number; at: number }>();

export function assertLoginAllowed(email: string) {
  const key = email.trim().toLowerCase();
  const row = loginAttempts.get(key);
  if (row && row.count >= 8 && Date.now() - row.at < 15 * 60 * 1000) {
    throw new Error("Too many sign-in attempts. Wait a few minutes and try again.");
  }
}

export function recordLoginFailure(email: string) {
  const key = email.trim().toLowerCase();
  const row = loginAttempts.get(key);
  if (!row || Date.now() - row.at > 15 * 60 * 1000) {
    loginAttempts.set(key, { count: 1, at: Date.now() });
  } else {
    row.count += 1;
    row.at = Date.now();
  }
}

export function clearLoginFailures(email: string) {
  loginAttempts.delete(email.trim().toLowerCase());
}
