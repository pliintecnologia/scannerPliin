import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { query } from "./db";
import { SESSION_COOKIE } from "./auth-constants";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 7;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  city: string;
  company: string | null;
  cpfLast4: string | null;
  cnpjLast4: string | null;
  tenantId: string;
  tenantName: string;
  role: "owner" | "admin" | "member";
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET deve ter pelo menos 32 caracteres.");
  return value;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, saltHex, hashHex] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashDocument(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  await query("DELETE FROM sessions WHERE expires_at <= NOW()");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const inserted = await query(
    `INSERT INTO sessions (user_id, tenant_id, token_hash, expires_at)
     SELECT $1, tenant_id, $2, $3 FROM memberships
     WHERE user_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1`,
    [userId, hashToken(token), expiresAt]
  );
  if (inserted.rowCount !== 1) throw new Error("Usuário sem tenant ativo.");
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await query<AuthUser>(
    `SELECT u.id, u.email, u.name, u.city, u.company,
      u.cpf_last4 AS "cpfLast4", u.cnpj_last4 AS "cnpjLast4",
      s.tenant_id AS "tenantId", t.name AS "tenantName", m.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN tenants t ON t.id = s.tenant_id AND t.active = TRUE
     JOIN memberships m ON m.user_id = u.id AND m.tenant_id = s.tenant_id AND m.status = 'active'
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.active = TRUE`,
    [hashToken(token)]
  );
  return result.rows[0] ?? null;
}

export async function checkRateLimit(key: string, limit: number, windowMinutes: number) {
  await query("DELETE FROM auth_attempts WHERE created_at < NOW() - INTERVAL '1 day'");
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM auth_attempts
     WHERE attempt_key = $1 AND created_at > NOW() - ($2 * INTERVAL '1 minute')`,
    [key, windowMinutes]
  );
  if (Number(result.rows[0]?.count || 0) >= limit) return false;
  await query("INSERT INTO auth_attempts (attempt_key) VALUES ($1)", [key]);
  return true;
}
