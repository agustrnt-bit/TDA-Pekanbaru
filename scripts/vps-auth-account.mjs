#!/usr/bin/env node
import { randomBytes, scrypt } from "node:crypto";
import { readFileSync } from "node:fs";
import process from "node:process";
import { Pool } from "pg";

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;

function usage() {
  console.error(`Usage:
  node scripts/vps-auth-account.mjs set-password <email> [display name] [--must-change]
  node scripts/vps-auth-account.mjs enable <email>
  node scripts/vps-auth-account.mjs disable <email>
  node scripts/vps-auth-account.mjs status <email>

For set-password, provide the password through stdin. Never put a password in the command line.`);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function readPepper() {
  const file = process.env.AUTH_PASSWORD_PEPPER_FILE;
  if (file) {
    const value = readFileSync(file, "utf8").trim();
    if (value) return value;
  }
  const direct = process.env.AUTH_PASSWORD_PEPPER?.trim();
  if (direct) return direct;
  throw new Error("AUTH_PASSWORD_PEPPER_FILE belum dikonfigurasi.");
}

function scryptAsync(input, salt) {
  return new Promise((resolve, reject) => {
    scrypt(
      input,
      salt,
      SCRYPT_KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 128 * 1024 * 1024 },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

async function hashPassword(password, pepper) {
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password harus 12-256 karakter.");
  }
  const salt = randomBytes(16);
  const derived = await scryptAsync(`${password}\u0000${pepper}`, salt);
  return [
    "scrypt-v1",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url"),
  ].join("$");
}

async function readPasswordFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").replace(/[\r\n]+$/, "");
}

const [command, emailRaw, ...rest] = process.argv.slice(2);
const email = normalizeEmail(emailRaw);
if (!command || !email || !email.includes("@")) {
  usage();
  process.exit(64);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");
const pool = new Pool({ connectionString, max: 2 });

try {
  if (command === "set-password") {
    const mustChange = rest.includes("--must-change");
    const displayName = rest.filter((value) => value !== "--must-change").join(" ").trim();
    const password = await readPasswordFromStdin();
    const passwordHash = await hashPassword(password, readPepper());
    await pool.query(
      `INSERT INTO vps_auth_accounts
        (email, display_name, password_hash, is_active, must_change_password,
         failed_attempts, locked_until, updated_at)
       VALUES ($1, $2, $3, TRUE, $4, 0, NULL, NOW())
       ON CONFLICT (email) DO UPDATE SET
         display_name = CASE
           WHEN EXCLUDED.display_name <> '' THEN EXCLUDED.display_name
           ELSE vps_auth_accounts.display_name
         END,
         password_hash = EXCLUDED.password_hash,
         is_active = TRUE,
         must_change_password = EXCLUDED.must_change_password,
         failed_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()`,
      [email, displayName, passwordHash, mustChange],
    );
    await pool.query(
      `UPDATE vps_auth_sessions SET revoked_at = NOW()
        WHERE email = $1 AND revoked_at IS NULL`,
      [email],
    );
    console.log(`Password akun ${email} diperbarui. Sesi lama dicabut.`);
  } else if (command === "disable") {
    const result = await pool.query(
      `UPDATE vps_auth_accounts
          SET is_active = FALSE, updated_at = NOW()
        WHERE email = $1`,
      [email],
    );
    await pool.query(
      `UPDATE vps_auth_sessions SET revoked_at = NOW()
        WHERE email = $1 AND revoked_at IS NULL`,
      [email],
    );
    console.log(result.rowCount ? `Akun ${email} dinonaktifkan.` : "Akun tidak ditemukan.");
  } else if (command === "enable") {
    const result = await pool.query(
      `UPDATE vps_auth_accounts
          SET is_active = TRUE, failed_attempts = 0, locked_until = NULL,
              updated_at = NOW()
        WHERE email = $1`,
      [email],
    );
    console.log(result.rowCount ? `Akun ${email} diaktifkan.` : "Akun tidak ditemukan.");
  } else if (command === "status") {
    const result = await pool.query(
      `SELECT email, display_name, is_active, must_change_password,
              failed_attempts, locked_until, last_login_at, created_at, updated_at
         FROM vps_auth_accounts
        WHERE email = $1`,
      [email],
    );
    if (!result.rows[0]) console.log("Akun tidak ditemukan.");
    else console.table([result.rows[0]]);
  } else {
    usage();
    process.exitCode = 64;
  }
} finally {
  await pool.end();
}
