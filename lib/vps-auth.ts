import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { cookies } from "next/headers";
import { Pool } from "pg";

export const VPS_SESSION_COOKIE = "tda_session";
const DEFAULT_SESSION_TTL_HOURS = 12;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const MAX_FAILED_PER_ACCOUNT = 5;
const ACCOUNT_LOCK_MINUTES = 15;
const MAX_FAILED_PER_IP = 20;

export type VpsSessionIdentity = {
  email: string;
  displayName: string;
  mustChangePassword: boolean;
};

type AccountRow = {
  email: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: Date | string | null;
};

export class VpsAuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 401) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

let pool: Pool | null = null;
let cachedSessionSecret: string | null = null;
let cachedPasswordPepper: string | null = null;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Math.max(2, Math.min(10, Number(process.env.AUTH_PG_POOL_MAX || 4))),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

function readSecret(fileEnv: string, directEnv: string) {
  const file = process.env[fileEnv];
  if (file) {
    const value = readFileSync(file, "utf8").trim();
    if (value) return value;
  }
  const direct = process.env[directEnv]?.trim();
  if (direct) return direct;
  throw new Error(`${fileEnv} belum dikonfigurasi.`);
}

function sessionSecret() {
  cachedSessionSecret ??= readSecret(
    "AUTH_SESSION_SECRET_FILE",
    "AUTH_SESSION_SECRET",
  );
  return cachedSessionSecret;
}

function passwordPepper() {
  cachedPasswordPepper ??= readSecret(
    "AUTH_PASSWORD_PEPPER_FILE",
    "AUTH_PASSWORD_PEPPER",
  );
  return cachedPasswordPepper;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function scryptAsync(
  input: string,
  salt: Buffer,
  keyLength = SCRYPT_KEY_LENGTH,
  n = SCRYPT_N,
  r = SCRYPT_R,
  p = SCRYPT_P,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      input,
      salt,
      keyLength,
      { N: n, r, p, maxmem: 128 * 1024 * 1024 },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey as Buffer);
      },
    );
  });
}

function passwordInput(password: string) {
  return `${password}\u0000${passwordPepper()}`;
}

export async function hashVpsPassword(password: string) {
  if (password.length < 12 || password.length > 256) {
    throw new VpsAuthError("weak_password", 400);
  }
  const salt = randomBytes(16);
  const derived = await scryptAsync(passwordInput(password), salt);
  return [
    "scrypt-v1",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

async function verifyPassword(password: string, encoded: string) {
  const [version, nRaw, rRaw, pRaw, saltRaw, hashRaw] = encoded.split("$");
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (
    version !== "scrypt-v1" ||
    !Number.isSafeInteger(n) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    n < 16384 ||
    n > 131072 ||
    r < 1 ||
    r > 16 ||
    p < 1 ||
    p > 4 ||
    !saltRaw ||
    !hashRaw
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltRaw, "base64url");
    const expected = Buffer.from(hashRaw, "base64url");
    const actual = await scryptAsync(
      passwordInput(password),
      salt,
      expected.length,
      n,
      r,
      p,
    );
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

async function consumeDummyPasswordWork(password: string) {
  await scryptAsync(
    passwordInput(password),
    Buffer.from("VDAuS2FtYW5UYVBla2FuYmFydQ", "base64url"),
  );
}

function tokenHash(token: string) {
  return createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function clientIpHash(request: Request) {
  return createHmac("sha256", sessionSecret())
    .update(clientIp(request))
    .digest("hex");
}

function ttlHours() {
  const value = Number(process.env.AUTH_SESSION_TTL_HOURS || DEFAULT_SESSION_TTL_HOURS);
  if (!Number.isFinite(value)) return DEFAULT_SESSION_TTL_HOURS;
  return Math.max(1, Math.min(720, value));
}

async function recordAttempt(email: string, ipHash: string, success: boolean) {
  await getPool().query(
    `INSERT INTO vps_auth_login_attempts (email, ip_hash, success)
     VALUES ($1, $2, $3)`,
    [email, ipHash, success],
  );
}

export async function authenticateVpsAccount(
  request: Request,
  emailInput: string,
  password: string,
) {
  const email = normalizeEmail(emailInput);
  if (!email || email.length > 320 || !password || password.length > 1024) {
    throw new VpsAuthError("invalid_credentials");
  }

  const ipHash = clientIpHash(request);
  const ipFailures = await getPool().query(
    `SELECT COUNT(*)::int AS count
       FROM vps_auth_login_attempts
      WHERE ip_hash = $1
        AND success = FALSE
        AND created_at > NOW() - INTERVAL '15 minutes'`,
    [ipHash],
  );
  if (Number(ipFailures.rows[0]?.count || 0) >= MAX_FAILED_PER_IP) {
    throw new VpsAuthError("rate_limited", 429);
  }

  const accountResult = await getPool().query(
    `SELECT email, display_name, password_hash, is_active,
            must_change_password, failed_attempts, locked_until
       FROM vps_auth_accounts
      WHERE email = $1
      LIMIT 1`,
    [email],
  );
  const account = accountResult.rows[0] as AccountRow | undefined;

  if (!account) {
    await consumeDummyPasswordWork(password);
    await recordAttempt(email, ipHash, false);
    throw new VpsAuthError("invalid_credentials");
  }

  const lockedUntil = account.locked_until
    ? new Date(account.locked_until).getTime()
    : 0;
  if (lockedUntil > Date.now()) {
    await recordAttempt(email, ipHash, false);
    throw new VpsAuthError("locked", 429);
  }

  const valid = await verifyPassword(password, account.password_hash);
  if (!valid) {
    await recordAttempt(email, ipHash, false);
    await getPool().query(
      `UPDATE vps_auth_accounts
          SET failed_attempts = failed_attempts + 1,
              locked_until = CASE
                WHEN failed_attempts + 1 >= $2
                  THEN NOW() + ($3 * INTERVAL '1 minute')
                ELSE locked_until
              END,
              updated_at = NOW()
        WHERE email = $1`,
      [email, MAX_FAILED_PER_ACCOUNT, ACCOUNT_LOCK_MINUTES],
    );
    throw new VpsAuthError("invalid_credentials");
  }

  if (!account.is_active) {
    await recordAttempt(email, ipHash, false);
    throw new VpsAuthError("invalid_credentials");
  }

  await recordAttempt(email, ipHash, true);
  await getPool().query(
    `UPDATE vps_auth_accounts
        SET failed_attempts = 0,
            locked_until = NULL,
            last_login_at = NOW(),
            updated_at = NOW()
      WHERE email = $1`,
    [email],
  );

  return {
    email,
    displayName: account.display_name || email,
    mustChangePassword: Boolean(account.must_change_password),
  } satisfies VpsSessionIdentity;
}

export async function createVpsSession(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlHours() * 60 * 60 * 1000);

  await getPool().query(
    `INSERT INTO vps_auth_sessions (token_hash, email, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash(token), email, expiresAt],
  );
  void getPool()
    .query(
      `DELETE FROM vps_auth_sessions
        WHERE expires_at < NOW() - INTERVAL '7 days'
           OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`,
    )
    .catch(() => undefined);

  return { token, expiresAt };
}

async function findSessionIdentity(token: string) {
  if (!token || token.length > 256) return null;
  const result = await getPool().query(
    `SELECT a.email, a.display_name, a.must_change_password
       FROM vps_auth_sessions s
       JOIN vps_auth_accounts a ON a.email = s.email
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND a.is_active = TRUE
      LIMIT 1`,
    [tokenHash(token)],
  );
  const row = result.rows[0] as
    | { email: string; display_name: string; must_change_password: boolean }
    | undefined;
  if (!row) return null;
  return {
    email: row.email,
    displayName: row.display_name || row.email,
    mustChangePassword: Boolean(row.must_change_password),
  } satisfies VpsSessionIdentity;
}

export async function getVpsSessionIdentity() {
  const cookieStore = await cookies();
  const token = cookieStore.get(VPS_SESSION_COOKIE)?.value;
  return token ? findSessionIdentity(token) : null;
}

export async function revokeVpsSession(token: string | null | undefined) {
  if (!token) return;
  await getPool().query(
    `UPDATE vps_auth_sessions
        SET revoked_at = NOW()
      WHERE token_hash = $1
        AND revoked_at IS NULL`,
    [tokenHash(token)],
  );
}

export async function changeVpsPassword(
  emailInput: string,
  currentPassword: string,
  newPassword: string,
) {
  const email = normalizeEmail(emailInput);
  const result = await getPool().query(
    `SELECT password_hash FROM vps_auth_accounts
      WHERE email = $1 AND is_active = TRUE LIMIT 1`,
    [email],
  );
  const currentHash = result.rows[0]?.password_hash as string | undefined;
  if (!currentHash || !(await verifyPassword(currentPassword, currentHash))) {
    throw new VpsAuthError("invalid_current_password", 400);
  }

  const nextHash = await hashVpsPassword(newPassword);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE vps_auth_accounts
          SET password_hash = $2,
              must_change_password = FALSE,
              failed_attempts = 0,
              locked_until = NULL,
              updated_at = NOW()
        WHERE email = $1`,
      [email, nextHash],
    );
    await client.query(
      `UPDATE vps_auth_sessions
          SET revoked_at = NOW()
        WHERE email = $1 AND revoked_at IS NULL`,
      [email],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function getRequestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

export function sessionCookieHeader(token: string, expiresAt: Date) {
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );
  return `${VPS_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader() {
  return `${VPS_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getAppOrigin() {
  const value = process.env.APP_ORIGIN?.trim();
  if (!value) throw new Error("APP_ORIGIN belum dikonfigurasi.");
  return new URL(value).origin;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === getAppOrigin();
  } catch {
    return false;
  }
}

export function safeReturnPath(value: string | null | undefined, fallback = "/admin") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return fallback;
    if (
      url.pathname === "/login" ||
      url.pathname === "/account/password" ||
      url.pathname.startsWith("/api/auth/") ||
      url.pathname === "/signin-with-chatgpt" ||
      url.pathname === "/signout-with-chatgpt" ||
      url.pathname === "/callback"
    ) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
