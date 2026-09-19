import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import pg from "pg";
import type { PoolClient, QueryResult } from "pg";

const { Pool, types } = pg;

// D1/SQLite returns ordinary JS numbers for the integer/decimal values used by
// this application. Keep the VPS compatibility layer close to that behavior.
types.setTypeParser(20, (value) => Number(value)); // int8 / bigint
types.setTypeParser(1700, (value) => Number(value)); // numeric

type Queryable = PoolClient | InstanceType<typeof Pool>;
type BoundValue = unknown;

type D1Meta = {
  changes: number;
  last_row_id: number;
  duration?: number;
};

type D1Result<T = Record<string, unknown>> = {
  success: true;
  results: T[];
  meta: D1Meta;
};

let pool: InstanceType<typeof Pool> | null = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL belum tersedia untuk runtime VPS. Isi hanya di environment staging/production, jangan commit credential.",
    );
  }

  pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (error) => {
    console.error("PostgreSQL pool error", error);
  });

  return pool;
}

function camelCaseAliases(sql: string) {
  const aliases = new Map<string, string>();
  const pattern = /\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    const alias = match[1];
    // Ignore CAST(... AS INTEGER/TEXT/REAL/...) and ordinary lowercase aliases.
    if (!/[a-z]/.test(alias) || !/[A-Z]/.test(alias)) continue;
    aliases.set(alias.toLowerCase(), alias);
  }
  return aliases;
}

function normalizeRowAliases(
  row: Record<string, unknown>,
  aliases: Map<string, string>,
) {
  if (!aliases.size) return row;
  const normalized = { ...row };
  for (const [postgresName, d1Name] of aliases) {
    if (
      postgresName !== d1Name &&
      Object.prototype.hasOwnProperty.call(normalized, postgresName) &&
      !Object.prototype.hasOwnProperty.call(normalized, d1Name)
    ) {
      normalized[d1Name] = normalized[postgresName];
      delete normalized[postgresName];
    }
  }
  return normalized;
}

function sqliteCompatibility(sql: string) {
  let output = sql;
  let insertOrIgnore = false;

  if (/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(output)) {
    insertOrIgnore = true;
    output = output.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO");
  }

  // SQLite GROUP_CONCAT(value [, separator]) maps to PostgreSQL STRING_AGG.
  // The Version 61 queries only use simple column references here.
  output = output.replace(
    /\bGROUP_CONCAT\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*,\s*'((?:''|[^'])*)'\s*\)/gi,
    (_match, expression: string, separator: string) =>
      `STRING_AGG(CAST(${expression} AS text), '${separator}')`,
  );
  output = output.replace(
    /\bGROUP_CONCAT\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\)/gi,
    "STRING_AGG(CAST($1 AS text), ',')",
  );

  // SQLite's NOCASE collation is primarily used here for case-insensitive
  // ordering. PostgreSQL does not ship an equivalent collation by that name.
  output = output.replace(
    /([A-Za-z_][A-Za-z0-9_.]*)\s+COLLATE\s+NOCASE/gi,
    "LOWER($1)",
  );

  // SQLite LIKE is case-insensitive for ASCII by default. ILIKE is the closest
  // PostgreSQL equivalent for the application's search fields.
  output = output.replace(/\bLIKE\b/gi, "ILIKE");
  output = output.replace(/\bIFNULL\s*\(/gi, "COALESCE(");

  // SQLite date()/datetime() return text. Keep that behavior for business
  // columns which were migrated from SQLite as TEXT.
  output = output.replace(
    /\bdatetime\s*\(\s*'now'\s*\)/gi,
    "TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')",
  );
  output = output.replace(
    /\bdate\s*\(\s*'now'\s*\)/gi,
    "TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')",
  );
  output = output.replace(
    /\bdatetime\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*|\?)\s*\)/gi,
    "REPLACE(SUBSTRING(CAST($1 AS text) FROM 1 FOR 19), 'T', ' ')",
  );
  output = output.replace(
    /\bdate\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*|\?)\s*\)/gi,
    "SUBSTRING(CAST($1 AS text) FROM 1 FOR 10)",
  );

  if (insertOrIgnore && !/\bON\s+CONFLICT\b/i.test(output)) {
    const returning = output.search(/\bRETURNING\b/i);
    if (returning >= 0) {
      output = `${output.slice(0, returning)} ON CONFLICT DO NOTHING ${output.slice(returning)}`;
    } else {
      const semicolon = output.trimEnd().endsWith(";");
      const base = semicolon ? output.trimEnd().slice(0, -1) : output;
      output = `${base} ON CONFLICT DO NOTHING${semicolon ? ";" : ""}`;
    }
  }

  return output;
}

function bindQuestionMarks(sql: string) {
  let index = 0;
  let output = "";
  let singleQuoted = false;
  let doubleQuoted = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (singleQuoted) {
      output += char;
      if (char === "'" && next === "'") {
        output += next;
        i += 1;
      } else if (char === "'") {
        singleQuoted = false;
      }
      continue;
    }

    if (doubleQuoted) {
      output += char;
      if (char === '"' && next === '"') {
        output += next;
        i += 1;
      } else if (char === '"') {
        doubleQuoted = false;
      }
      continue;
    }

    if (char === "'") {
      singleQuoted = true;
      output += char;
      continue;
    }
    if (char === '"') {
      doubleQuoted = true;
      output += char;
      continue;
    }
    if (char === "?") {
      index += 1;
      output += `$${index}`;
      continue;
    }
    output += char;
  }

  return output;
}

function translateSql(sql: string) {
  return bindQuestionMarks(sqliteCompatibility(sql));
}

function resultMeta(result: QueryResult, lastRowId = 0): D1Meta {
  return {
    changes: result.rowCount ?? 0,
    last_row_id: Number(lastRowId || 0),
  };
}

function isInsert(sql: string) {
  return /^\s*INSERT\b/i.test(sql);
}

function alreadyReturns(sql: string) {
  return /\bRETURNING\b/i.test(sql);
}

function addReturningId(sql: string) {
  const semicolon = sql.trimEnd().endsWith(";");
  const base = semicolon ? sql.trimEnd().slice(0, -1) : sql;
  return `${base} RETURNING id${semicolon ? ";" : ""}`;
}

function compactSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim().slice(0, 2000);
}

class VpsPreparedStatement {
  private values: BoundValue[] = [];

  constructor(
    private readonly database: VpsD1Database,
    readonly sourceSql: string,
  ) {}

  bind(...values: BoundValue[]) {
    const statement = new VpsPreparedStatement(this.database, this.sourceSql);
    statement.values = values;
    return statement;
  }

  private translatedSql() {
    return translateSql(this.sourceSql);
  }

  private aliases() {
    return camelCaseAliases(this.sourceSql);
  }

  private normalizeResult(result: QueryResult) {
    const aliases = this.aliases();
    if (!aliases.size || !result.rows.length) return result;
    return {
      ...result,
      rows: result.rows.map((row) =>
        normalizeRowAliases(row as Record<string, unknown>, aliases),
      ),
    } as QueryResult;
  }

  private logQueryError(error: unknown, translatedSql: string) {
    const detail = error as { code?: string; message?: string };
    console.error("PostgreSQL compatibility query failed", {
      code: detail.code,
      message: detail.message,
      sourceSql: compactSql(this.sourceSql),
      translatedSql: compactSql(translatedSql),
    });
  }

  private async query(queryable: Queryable, sql: string) {
    try {
      return this.normalizeResult(await queryable.query(sql, this.values));
    } catch (error) {
      this.logQueryError(error, sql);
      throw error;
    }
  }

  async execute(queryable: Queryable = getPool()) {
    return this.query(queryable, this.translatedSql());
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const result = await this.execute();
    return {
      success: true,
      results: result.rows as T[],
      meta: resultMeta(result),
    };
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const result = await this.execute();
    const row = result.rows[0] as T | undefined;
    if (!row) return null;
    if (columnName) return (row as Record<string, unknown>)[columnName] as T;
    return row;
  }

  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
    const result = await this.execute();
    const aliases = this.aliases();
    const fields = result.fields.map(
      (field) => aliases.get(field.name.toLowerCase()) ?? field.name,
    );
    const rows = result.rows.map((row) =>
      fields.map((field) => (row as Record<string, unknown>)[field]),
    ) as T[];
    if (options?.columnNames) return [fields as unknown as T, ...rows];
    return rows;
  }

  async run(): Promise<D1Result> {
    const translated = this.translatedSql();
    let result: QueryResult;
    let lastRowId = 0;

    if (isInsert(translated) && !alreadyReturns(translated)) {
      const withReturning = addReturningId(translated);
      try {
        result = this.normalizeResult(
          await getPool().query(withReturning, this.values),
        );
        lastRowId = Number(result.rows[0]?.id ?? 0);
      } catch (error) {
        // 42703 = undefined_column. Junction/config tables without an id column
        // are retried without RETURNING. The failed PostgreSQL statement is
        // atomic, so it has not inserted a duplicate row before the retry.
        if ((error as { code?: string }).code !== "42703") {
          this.logQueryError(error, withReturning);
          throw error;
        }
        result = await this.query(getPool(), translated);
      }
    } else {
      result = await this.query(getPool(), translated);
      lastRowId = Number(result.rows[0]?.id ?? 0);
    }

    return {
      success: true,
      results: result.rows,
      meta: resultMeta(result, lastRowId),
    };
  }
}

class VpsD1Database {
  prepare(sql: string) {
    return new VpsPreparedStatement(this, sql);
  }

  async batch(statements: VpsPreparedStatement[]) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const results: D1Result[] = [];
      for (const statement of statements) {
        const result = await statement.execute(client);
        results.push({
          success: true,
          results: result.rows,
          meta: resultMeta(result, Number(result.rows[0]?.id ?? 0)),
        });
      }
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async exec(sql: string) {
    const translated = sqliteCompatibility(sql);
    try {
      const result = await getPool().query(translated);
      return {
        count: result.rowCount ?? 0,
        duration: 0,
      };
    } catch (error) {
      const detail = error as { code?: string; message?: string };
      console.error("PostgreSQL compatibility exec failed", {
        code: detail.code,
        message: detail.message,
        sourceSql: compactSql(sql),
        translatedSql: compactSql(translated),
      });
      throw error;
    }
  }
}

type HttpMetadata = {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
};

type StoredMetadata = {
  httpMetadata?: Omit<HttpMetadata, "cacheExpiry"> & { cacheExpiry?: string };
  customMetadata?: Record<string, string>;
};

const storageRoot = resolve(
  process.env.UPLOAD_PATH || "/srv/tda-staging/storage/uploads",
);
const metadataRoot = resolve(storageRoot, ".tda-metadata");

function safeObjectPath(root: string, key: string) {
  const normalizedKey = key.replace(/^\/+/, "");
  const path = resolve(root, normalizedKey);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error("Object key tidak valid.");
  }
  return path;
}

function objectPath(key: string) {
  return safeObjectPath(storageRoot, key);
}

function metadataPath(key: string) {
  return `${safeObjectPath(metadataRoot, key)}.json`;
}

async function loadMetadata(key: string): Promise<StoredMetadata> {
  try {
    return JSON.parse(await readFile(metadataPath(key), "utf8")) as StoredMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function saveMetadata(key: string, metadata: StoredMetadata) {
  const path = metadataPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(metadata), { mode: 0o600 });
}

function applyHttpMetadata(headers: Headers, metadata: HttpMetadata = {}) {
  if (metadata.contentType) headers.set("content-type", metadata.contentType);
  if (metadata.contentLanguage) headers.set("content-language", metadata.contentLanguage);
  if (metadata.contentDisposition) headers.set("content-disposition", metadata.contentDisposition);
  if (metadata.contentEncoding) headers.set("content-encoding", metadata.contentEncoding);
  if (metadata.cacheControl) headers.set("cache-control", metadata.cacheControl);
  if (metadata.cacheExpiry) headers.set("expires", metadata.cacheExpiry.toUTCString());
}

class VpsR2ObjectBody {
  readonly body: ReadableStream<Uint8Array>;
  readonly size: number;
  readonly httpMetadata: HttpMetadata;
  readonly customMetadata?: Record<string, string>;

  constructor(
    readonly key: string,
    path: string,
    fileSize: number,
    metadata: StoredMetadata,
  ) {
    this.size = fileSize;
    this.body = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
    this.httpMetadata = {
      ...metadata.httpMetadata,
      cacheExpiry: metadata.httpMetadata?.cacheExpiry
        ? new Date(metadata.httpMetadata.cacheExpiry)
        : undefined,
    };
    this.customMetadata = metadata.customMetadata;
  }

  writeHttpMetadata(headers: Headers) {
    applyHttpMetadata(headers, this.httpMetadata);
  }
}

class VpsR2Bucket {
  async put(
    key: string,
    value: BodyInit | null,
    options?: {
      httpMetadata?: HttpMetadata;
      customMetadata?: Record<string, string>;
    },
  ) {
    const path = objectPath(key);
    await mkdir(dirname(path), { recursive: true });

    const bytes = Buffer.from(await new Response(value).arrayBuffer());
    const temporary = `${path}.tmp-${process.pid}-${crypto.randomUUID()}`;
    await writeFile(temporary, bytes, { mode: 0o640 });
    await rename(temporary, path);

    await saveMetadata(key, {
      httpMetadata: options?.httpMetadata
        ? {
            ...options.httpMetadata,
            cacheExpiry: options.httpMetadata.cacheExpiry?.toISOString(),
          }
        : undefined,
      customMetadata: options?.customMetadata,
    });

    return {
      key,
      size: bytes.byteLength,
      uploaded: new Date(),
      httpEtag: "",
      etag: "",
      version: "local",
    };
  }

  async get(key: string) {
    const path = objectPath(key);
    try {
      const info = await stat(path);
      if (!info.isFile()) return null;
      return new VpsR2ObjectBody(key, path, info.size, await loadMetadata(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async head(key: string) {
    const object = await this.get(key);
    if (!object) return null;
    return {
      key: object.key,
      size: object.size,
      httpMetadata: object.httpMetadata,
      customMetadata: object.customMetadata,
      writeHttpMetadata: (headers: Headers) => object.writeHttpMetadata(headers),
    };
  }

  async delete(keyOrKeys: string | string[]) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    await Promise.all(
      keys.flatMap((key) => [
        unlink(objectPath(key)).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }),
        unlink(metadataPath(key)).catch((error) => {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }),
      ]),
    );
  }
}

export const env = {
  DB: new VpsD1Database(),
  BUCKET: new VpsR2Bucket(),
};
