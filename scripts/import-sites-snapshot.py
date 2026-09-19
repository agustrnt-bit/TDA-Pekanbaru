#!/usr/bin/env python3
"""Import a validated Sites D1 snapshot into the staging PostgreSQL container.

Safety properties:
- refuses a snapshot whose D1 schema differs from the audited 2026-09-19 manifest;
- refuses to run if any migrated business table already exists;
- preserves the three VPS local-auth tables;
- executes schema creation, data import, indexes, foreign keys, sequence resets,
  and row-count checks in a single PostgreSQL transaction;
- does not read or print database passwords.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

EXPECTED_SCHEMA_DIGEST = "c70fc7cda4bccea11e7475c54483d772061d50276097762b1dc661777f6fc935"
INTERNAL_D1_TABLE = "__appgarden_migrations"
ALLOWED_PREEXISTING_TABLES = {
    "vps_auth_accounts",
    "vps_auth_login_attempts",
    "vps_auth_sessions",
}
IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def fail(message: str) -> None:
    raise RuntimeError(message)


def qident(value: str) -> str:
    if not IDENTIFIER.fullmatch(value):
        fail(f"Identifier tidak aman: {value!r}")
    return '"' + value + '"'


def canonical_schema_digest(manifest: dict[str, Any]) -> str:
    tables = [
        {"name": table["name"], "ddl": table.get("ddl")}
        for table in manifest.get("tables", [])
        if table.get("name") != INTERNAL_D1_TABLE
    ]
    indexes = [
        {"name": item["name"], "tableName": item["tableName"], "ddl": item.get("ddl")}
        for item in manifest.get("indexes", [])
        if item.get("tableName") != INTERNAL_D1_TABLE and item.get("ddl") is not None
    ]
    payload = {
        "tables": tables,
        "indexes": indexes,
        "triggers": manifest.get("triggers", []),
        "views": manifest.get("views", []),
    }
    raw = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def split_top_level(value: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    quote: str | None = None
    index = 0
    while index < len(value):
        char = value[index]
        if quote is not None:
            if char == quote:
                if index + 1 < len(value) and value[index + 1] == quote:
                    index += 2
                    continue
                quote = None
            index += 1
            continue
        if char in {"'", '"', "`"}:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "," and depth == 0:
            parts.append(value[start:index].strip())
            start = index + 1
        index += 1
    tail = value[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def columns_from_ddl(ddl: str) -> list[str]:
    first = ddl.find("(")
    last = ddl.rfind(")")
    if first < 0 or last <= first:
        fail("DDL tabel tidak valid.")
    names: list[str] = []
    for part in split_top_level(ddl[first + 1 : last]):
        if part.strip().upper().startswith("FOREIGN KEY"):
            continue
        match = re.match(r'[`"]?([A-Za-z_][A-Za-z0-9_]*)[`"]?\s+[A-Za-z]+', part.strip())
        if not match:
            fail(f"Gagal membaca kolom dari DDL: {part}")
        names.append(match.group(1))
    return names


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            fail("Float non-finite ditemukan di snapshot.")
        return repr(value)
    if isinstance(value, str):
        if "\x00" in value:
            fail("Teks mengandung NUL byte yang tidak didukung PostgreSQL TEXT.")
        return "'" + value.replace("'", "''") + "'"
    fail(f"Tipe nilai snapshot tidak didukung: {type(value).__name__}")
    return "NULL"


def run_psql(
    container: str,
    user: str,
    database: str,
    *,
    sql: str | None = None,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    command = [
        "docker",
        "exec",
        "-i",
        container,
        "psql",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        user,
        "-d",
        database,
    ]
    if sql is not None:
        command.extend(["-At", "-c", sql])
        return subprocess.run(
            command,
            check=True,
            text=True,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
        )
    return subprocess.run(command, check=True, text=True)


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        fail(f"File tidak ditemukan: {path}")
        raise exc
    except json.JSONDecodeError as exc:
        fail(f"JSON tidak valid: {path}: {exc}")
        raise exc
    if not isinstance(value, dict):
        fail(f"JSON harus object: {path}")
    return value


def validate_snapshot(snapshot: Path) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    root_validation = load_json(snapshot / "validation.json")
    if root_validation.get("success") is not True:
        fail("Snapshot tidak berstatus success=true.")

    d1_validation = load_json(snapshot / "d1" / "validation.json")
    if d1_validation.get("allCountsMatch") is not True:
        fail("Validasi row count D1 tidak bersih.")

    manifest = load_json(snapshot / "d1" / "manifest.json")
    digest = canonical_schema_digest(manifest)
    if digest != EXPECTED_SCHEMA_DIGEST:
        fail(
            "Schema D1 snapshot berbeda dari manifest yang sudah diaudit. "
            f"expected={EXPECTED_SCHEMA_DIGEST}, actual={digest}"
        )

    validation_tables = d1_validation.get("tables")
    if not isinstance(validation_tables, list):
        fail("d1/validation.json tidak memiliki tables yang valid.")

    business = [
        item
        for item in validation_tables
        if isinstance(item, dict) and item.get("name") != INTERNAL_D1_TABLE
    ]
    if len(business) != 32:
        fail(f"Jumlah tabel bisnis harus 32, ditemukan {len(business)}.")

    return manifest, d1_validation, business


def preflight_database(container: str, user: str, database: str, business_names: set[str]) -> None:
    result = run_psql(
        container,
        user,
        database,
        sql="SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;",
        capture=True,
    )
    existing = {line.strip() for line in result.stdout.splitlines() if line.strip()}
    conflict = existing & business_names
    unexpected = existing - ALLOWED_PREEXISTING_TABLES
    if conflict:
        fail(
            "Import dibatalkan karena tabel bisnis sudah ada: "
            + ", ".join(sorted(conflict))
        )
    if unexpected:
        fail(
            "Import dibatalkan karena ada tabel public yang tidak dikenal: "
            + ", ".join(sorted(unexpected))
        )
    missing_auth = ALLOWED_PREEXISTING_TABLES - existing
    if missing_auth:
        fail(
            "Tabel autentikasi VPS belum lengkap: "
            + ", ".join(sorted(missing_auth))
        )


def stream_import_sql(
    proc: subprocess.Popen[str],
    snapshot: Path,
    schema_sql: str,
    constraints_sql: str,
    manifest: dict[str, Any],
    business_validation: list[dict[str, Any]],
) -> None:
    assert proc.stdin is not None

    manifest_by_name = {
        table["name"]: table
        for table in manifest["tables"]
        if table["name"] != INTERNAL_D1_TABLE
    }

    def write(text: str) -> None:
        proc.stdin.write(text)

    write("\\set ON_ERROR_STOP on\n")
    write("SET client_min_messages TO WARNING;\n")
    write("BEGIN;\n")
    write(schema_sql)
    if not schema_sql.endswith("\n"):
        write("\n")

    expected_total = 0
    for item in business_validation:
        table_name = str(item["name"])
        expected = int(item["manifestRowCount"])
        exported = int(item["exportedRowCount"])
        if expected != exported or item.get("status") != "ok":
            fail(f"Validasi tabel {table_name} tidak cocok sebelum import.")
        expected_total += expected

        table_manifest = manifest_by_name.get(table_name)
        if table_manifest is None or not isinstance(table_manifest.get("ddl"), str):
            fail(f"DDL tabel {table_name} tidak ditemukan.")
        columns = columns_from_ddl(table_manifest["ddl"])
        expected_columns = set(columns)

        rows_file = snapshot / str(item["rowsFile"])
        if not rows_file.is_file():
            fail(f"Rows file tidak ditemukan: {rows_file}")

        print(f"[PG] {table_name}: import {expected} baris", flush=True)
        actual_lines = 0
        with rows_file.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError as exc:
                    fail(f"NDJSON rusak {rows_file}:{line_number}: {exc}")
                if not isinstance(row, dict):
                    fail(f"Row bukan object {rows_file}:{line_number}")
                if set(row.keys()) != expected_columns:
                    missing = sorted(expected_columns - set(row.keys()))
                    extra = sorted(set(row.keys()) - expected_columns)
                    fail(
                        f"Kolom row {table_name} berbeda pada baris {line_number}; "
                        f"missing={missing}, extra={extra}"
                    )
                values = ", ".join(sql_literal(row[column]) for column in columns)
                write(
                    f"INSERT INTO {qident(table_name)} "
                    f"({', '.join(qident(column) for column in columns)}) "
                    f"VALUES ({values});\n"
                )
                actual_lines += 1
        if actual_lines != expected:
            fail(
                f"Rows file {table_name} berisi {actual_lines} row, expected {expected}."
            )

    write(constraints_sql)
    if not constraints_sql.endswith("\n"):
        write("\n")

    for table in manifest["tables"]:
        table_name = table["name"]
        if table_name == INTERNAL_D1_TABLE:
            continue
        ddl = str(table.get("ddl") or "")
        if re.search(
            r'[`"]?id[`"]?\s+integer\s+PRIMARY\s+KEY\s+AUTOINCREMENT',
            ddl,
            re.IGNORECASE,
        ):
            qt = qident(table_name)
            write(
                "SELECT setval(pg_get_serial_sequence("
                f"{sql_literal(table_name)}, 'id'), "
                f"COALESCE((SELECT MAX(\"id\") FROM {qt}), 1), "
                f"(SELECT COUNT(*) > 0 FROM {qt}));\n"
            )

    for item in business_validation:
        table_name = str(item["name"])
        expected = int(item["manifestRowCount"])
        qt = qident(table_name)
        label = table_name.replace("'", "''")
        write(
            "DO $$ DECLARE n BIGINT; BEGIN "
            f"SELECT COUNT(*) INTO n FROM {qt}; "
            f"IF n <> {expected} THEN "
            f"RAISE EXCEPTION 'row count mismatch {label}: expected {expected}, got %', n; "
            "END IF; END $$;\n"
        )

    write("COMMIT;\n")
    proc.stdin.close()
    print(f"[PG] SQL dikirim: 32 tabel, {expected_total} baris bisnis.", flush=True)


def verify_counts(
    container: str,
    user: str,
    database: str,
    business_validation: list[dict[str, Any]],
) -> None:
    selects = []
    expected_by_name: dict[str, int] = {}
    for item in business_validation:
        name = str(item["name"])
        expected = int(item["manifestRowCount"])
        expected_by_name[name] = expected
        selects.append(
            f"SELECT {sql_literal(name)} AS name, COUNT(*)::BIGINT AS n FROM {qident(name)}"
        )
    query = " UNION ALL ".join(selects) + " ORDER BY name;"
    result = run_psql(container, user, database, sql=query, capture=True)
    actual: dict[str, int] = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        name, count = line.split("|", 1)
        actual[name] = int(count)

    mismatches = [
        (name, expected, actual.get(name))
        for name, expected in expected_by_name.items()
        if actual.get(name) != expected
    ]
    if mismatches:
        fail(f"Post-commit count validation gagal: {mismatches}")

    total = sum(actual.values())
    print(f"VALIDASI POSTGRESQL: OK — 32 tabel bisnis, {total} baris.", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import validated Sites D1 snapshot into staging PostgreSQL."
    )
    parser.add_argument("snapshot", help="Path snapshot Sites yang sudah tervalidasi")
    parser.add_argument("--container", default="tda-staging-postgres")
    parser.add_argument("--db", default="tda_staging")
    parser.add_argument("--user", default="tda_app")
    parser.add_argument(
        "--schema",
        default="deploy/postgres/business-schema.sql",
        help="SQL CREATE TABLE tanpa FK/index sekunder",
    )
    parser.add_argument(
        "--constraints",
        default="deploy/postgres/business-constraints.sql",
        help="SQL FK dan secondary/unique indexes",
    )
    args = parser.parse_args()

    snapshot = Path(args.snapshot).resolve()
    schema_path = Path(args.schema)
    constraints_path = Path(args.constraints)
    schema_sql = schema_path.read_text(encoding="utf-8")
    constraints_sql = constraints_path.read_text(encoding="utf-8")

    manifest, _d1_validation, business_validation = validate_snapshot(snapshot)
    business_names = {str(item["name"]) for item in business_validation}

    print("Preflight snapshot: OK", flush=True)
    print("Preflight schema digest: OK", flush=True)
    preflight_database(args.container, args.user, args.db, business_names)
    print("Preflight PostgreSQL: OK — hanya tabel auth VPS yang sudah ada.", flush=True)

    command = [
        "docker",
        "exec",
        "-i",
        args.container,
        "psql",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        args.user,
        "-d",
        args.db,
    ]
    proc = subprocess.Popen(command, stdin=subprocess.PIPE, text=True)
    try:
        stream_import_sql(
            proc,
            snapshot,
            schema_sql,
            constraints_sql,
            manifest,
            business_validation,
        )
    except Exception:
        if proc.stdin is not None and not proc.stdin.closed:
            proc.stdin.close()
        proc.wait(timeout=30)
        raise

    return_code = proc.wait()
    if return_code != 0:
        fail(
            f"psql gagal (exit {return_code}). Transaksi PostgreSQL seharusnya rollback otomatis."
        )

    verify_counts(args.container, args.user, args.db, business_validation)
    print("IMPORT D1 -> POSTGRESQL SELESAI.", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Dibatalkan.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
