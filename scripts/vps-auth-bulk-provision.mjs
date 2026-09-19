#!/usr/bin/env node
import { randomBytes, scrypt } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import process from "node:process";
import { Pool } from "pg";

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const DEFAULT_OUTPUT_DIR = "/srv/tda-staging/env";

function usage() {
  console.log(`Usage:
  node scripts/vps-auth-bulk-provision.mjs --dry-run
  node scripts/vps-auth-bulk-provision.mjs --apply [--output-dir /secure/path]

Behavior:
- reads active users from the business users table;
- skips emails that already exist in vps_auth_accounts;
- creates one strong temporary password per missing account;
- forces password change on first login;
- never prints temporary passwords to the terminal;
- writes credentials only to a chmod 600 file outside the repository.`);
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

function temporaryPassword() {
  // 24 random bytes -> 32 base64url characters, comfortably above the 12-char minimum.
  return randomBytes(24).toString("base64url");
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  let mode = "dry-run";
  let outputDir = DEFAULT_OUTPUT_DIR;
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--dry-run") mode = "dry-run";
    else if (value === "--apply") mode = "apply";
    else if (value === "--output-dir") {
      const next = argv[i + 1];
      if (!next) throw new Error("--output-dir membutuhkan path.");
      outputDir = next;
      i += 1;
    } else if (value === "--help" || value === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Argumen tidak dikenali: ${value}`);
    }
  }
  return { mode, outputDir };
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

const { mode, outputDir } = parseArgs(process.argv.slice(2));
const pool = new Pool({ connectionString, max: 2 });

try {
  const usersResult = await pool.query(
    `SELECT id, name, email, role
       FROM users
      WHERE is_active = 1
      ORDER BY id`,
  );
  const authResult = await pool.query(
    `SELECT email, is_active, must_change_password
       FROM vps_auth_accounts
      ORDER BY email`,
  );

  const existing = new Map(
    authResult.rows.map((row) => [normalizeEmail(row.email), row]),
  );
  const candidates = usersResult.rows
    .map((row) => ({ ...row, email: normalizeEmail(row.email) }))
    .filter((row) => row.email && !existing.has(row.email));

  console.log(`User aktif di users      : ${usersResult.rowCount}`);
  console.log(`Akun VPS sudah tersedia : ${authResult.rowCount}`);
  console.log(`Akun VPS akan dibuat    : ${candidates.length}`);

  if (candidates.length === 0) {
    console.log("Tidak ada akun baru yang perlu dibuat.");
    process.exit(0);
  }

  for (const row of candidates) {
    console.log(`- ${row.name} <${row.email}> (${row.role})`);
  }

  if (mode !== "apply") {
    console.log("\nDRY RUN selesai. Tidak ada akun/password yang diubah.");
    console.log("Jika daftar di atas benar, jalankan ulang dengan --apply.");
    process.exit(0);
  }

  const pepper = readPepper();
  const credentials = [];
  for (const row of candidates) {
    const password = temporaryPassword();
    credentials.push({
      ...row,
      password,
      passwordHash: await hashPassword(password, pepper),
    });
  }

  mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const outputPath = `${outputDir.replace(/\/$/, "")}/initial-user-passwords-${timestamp()}.txt`;
  const lines = [
    "TDA Pekanbaru — Password sementara akun VPS",
    `Dibuat: ${new Date().toISOString()}`,
    "RAHASIA. Bagikan hanya password milik masing-masing pengguna.",
    "Pengguna diwajibkan mengganti password setelah login pertama.",
    "",
    ...credentials.flatMap((item) => [
      `Nama     : ${item.name}`,
      `Email    : ${item.email}`,
      `Role     : ${item.role}`,
      `Password : ${item.password}`,
      "",
    ]),
  ];

  writeFileSync(outputPath, `${lines.join("\n")}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  chmodSync(outputPath, 0o600);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of credentials) {
      await client.query(
        `INSERT INTO vps_auth_accounts
          (email, display_name, password_hash, is_active, must_change_password,
           failed_attempts, locked_until, updated_at)
         VALUES ($1, $2, $3, TRUE, TRUE, 0, NULL, NOW())
         ON CONFLICT (email) DO NOTHING`,
        [item.email, item.name, item.passwordHash],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    try {
      unlinkSync(outputPath);
    } catch {}
    throw error;
  } finally {
    client.release();
  }

  console.log(`\nBERHASIL: ${credentials.length} akun VPS baru dibuat.`);
  console.log("Semua akun baru aktif dan wajib mengganti password pada login pertama.");
  console.log(`File password sementara (mode 600): ${outputPath}`);
  console.log("Password tidak ditampilkan di terminal.");
  console.log("Setelah seluruh password dibagikan, hapus file tersebut dari VPS.");
} finally {
  await pool.end();
}
