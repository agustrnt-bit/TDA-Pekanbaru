#!/usr/bin/env python3
"""Pull a read-only migration export from the temporary Sites backup bridge.

The script intentionally uses only Python's standard library and never prints the
Bearer token. It stores raw manifests, D1 rows as NDJSON, R2 objects by SHA-256,
and a validation summary under a timestamped snapshot directory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import shutil
import stat
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

SCRIPT_VERSION = "1.0"
DEFAULT_BASE_URL = "https://tdapku.my.id"
DEFAULT_TOKEN_FILE = "/srv/tda-staging/env/migration_export_token"
DEFAULT_OUTPUT_ROOT = "/srv/tda-staging/backups/sites-export"
RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp-{os.getpid()}-{random.randrange(1_000_000):06d}")
    with temp.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
    os.replace(temp, path)


def read_token(path: Path) -> str:
    try:
        mode = stat.S_IMODE(path.stat().st_mode)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Token file tidak ditemukan: {path}") from exc
    if mode & 0o077:
        raise RuntimeError(
            f"Permission token file terlalu terbuka ({oct(mode)}). Gunakan chmod 600 {path}."
        )
    token = path.read_text(encoding="utf-8").strip()
    if not token:
        raise RuntimeError("Token export kosong.")
    return token


def request_bytes(url: str, token: str, *, timeout: int = 120, attempts: int = 5) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        request = Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "User-Agent": f"TDA-Migration-Exporter/{SCRIPT_VERSION}",
            },
            method="GET",
        )
        try:
            with urlopen(request, timeout=timeout) as response:
                return response.read()
        except HTTPError as exc:
            last_error = exc
            if exc.code not in RETRYABLE_STATUS or attempt == attempts:
                body = b""
                try:
                    body = exc.read(2048)
                except Exception:
                    pass
                detail = body.decode("utf-8", "replace").strip()
                raise RuntimeError(f"HTTP {exc.code} dari endpoint export: {detail[:500]}") from exc
        except URLError as exc:
            last_error = exc
            if attempt == attempts:
                raise RuntimeError(f"Gagal menghubungi endpoint export: {exc.reason}") from exc
        delay = min(20.0, (2 ** (attempt - 1)) + random.random())
        time.sleep(delay)
    raise RuntimeError(f"Permintaan gagal: {last_error}")


def request_json(url: str, token: str) -> dict[str, Any]:
    raw = request_bytes(url, token)
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Respons bukan JSON valid dari {url}") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Respons JSON tidak berbentuk object dari {url}")
    return parsed


def api_url(base_url: str, path: str, params: dict[str, Any] | None = None) -> str:
    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    if params:
        clean = {key: value for key, value in params.items() if value is not None}
        if clean:
            url = f"{url}?{urlencode(clean)}"
    return url


def export_d1(base_url: str, token: str, root: Path, page_limit: int) -> dict[str, Any]:
    d1_root = root / "d1"
    d1_root.mkdir(parents=True, exist_ok=True)

    manifest_url = api_url(base_url, "/api/migration-export/d1/manifest")
    manifest = request_json(manifest_url, token)
    write_json(d1_root / "manifest.json", manifest)

    tables = manifest.get("tables")
    if not isinstance(tables, list):
        raise RuntimeError("Manifest D1 tidak memiliki daftar tables yang valid.")

    validation_tables: list[dict[str, Any]] = []
    total_rows = 0

    for position, table in enumerate(tables, start=1):
        if not isinstance(table, dict) or not isinstance(table.get("name"), str):
            raise RuntimeError("Manifest D1 berisi definisi tabel yang tidak valid.")
        table_name = table["name"]
        expected = int(table.get("rowCount") or 0)
        print(f"[D1 {position}/{len(tables)}] {table_name}: target manifest {expected} baris", flush=True)

        safe_dir_name = hashlib.sha256(table_name.encode("utf-8")).hexdigest()[:16]
        table_root = d1_root / "tables" / safe_dir_name
        table_root.mkdir(parents=True, exist_ok=True)
        write_json(
            table_root / "table.json",
            {"name": table_name, "ddl": table.get("ddl"), "manifestRowCount": expected},
        )

        rows_path = table_root / "rows.ndjson"
        cursor: Any = None
        seen_cursors: set[str] = set()
        page_number = 0
        actual = 0
        pagination_kind: str | None = None
        primary_key: Any = None

        with rows_path.open("w", encoding="utf-8", newline="\n") as rows_handle:
            while True:
                params: dict[str, Any] = {"limit": page_limit}
                if cursor is not None:
                    params["cursor"] = cursor
                path = f"/api/migration-export/d1/{quote(table_name, safe='')}"
                page = request_json(api_url(base_url, path, params), token)
                page_number += 1

                if page.get("table") != table_name:
                    raise RuntimeError(f"Endpoint D1 mengembalikan nama tabel berbeda untuk {table_name}.")
                if pagination_kind is None:
                    pagination_kind = str(page.get("pagination") or "unknown")
                    primary_key = page.get("primaryKey")

                rows = page.get("rows")
                if not isinstance(rows, list):
                    raise RuntimeError(f"Respons tabel {table_name} tidak memiliki rows yang valid.")
                for row in rows:
                    rows_handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")))
                    rows_handle.write("\n")
                actual += len(rows)

                next_cursor = page.get("cursor")
                if next_cursor is None:
                    break
                cursor_key = json.dumps(next_cursor, ensure_ascii=False, sort_keys=True)
                if cursor_key in seen_cursors:
                    raise RuntimeError(f"Cursor D1 berulang pada tabel {table_name}; export dihentikan.")
                seen_cursors.add(cursor_key)
                cursor = next_cursor

        total_rows += actual
        status = "ok" if actual == expected else "count_mismatch"
        validation_tables.append(
            {
                "name": table_name,
                "manifestRowCount": expected,
                "exportedRowCount": actual,
                "status": status,
                "pages": page_number,
                "pagination": pagination_kind,
                "primaryKey": primary_key,
                "rowsFile": str(rows_path.relative_to(root)),
            }
        )
        print(f"  -> {actual} baris ({status})", flush=True)

    result = {
        "tableCount": len(validation_tables),
        "rowCount": total_rows,
        "tables": validation_tables,
        "allCountsMatch": all(item["status"] == "ok" for item in validation_tables),
    }
    write_json(d1_root / "validation.json", result)
    return result


def list_r2_objects(base_url: str, token: str, root: Path, page_limit: int) -> list[dict[str, Any]]:
    manifest_root = root / "r2" / "manifests"
    manifest_root.mkdir(parents=True, exist_ok=True)

    cursor: Any = None
    seen_cursors: set[str] = set()
    page_number = 0
    objects: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    while True:
        params: dict[str, Any] = {"limit": page_limit}
        if cursor is not None:
            params["cursor"] = cursor
        page = request_json(api_url(base_url, "/api/migration-export/r2/manifest", params), token)
        page_number += 1
        write_json(manifest_root / f"page-{page_number:06d}.json", page)

        listed = page.get("objects")
        if not isinstance(listed, list):
            raise RuntimeError("Manifest R2 tidak memiliki objects yang valid.")
        for item in listed:
            if not isinstance(item, dict) or not isinstance(item.get("key"), str):
                raise RuntimeError("Manifest R2 berisi object yang tidak valid.")
            key = item["key"]
            if key in seen_keys:
                raise RuntimeError(f"Key R2 muncul dua kali di manifest: {key}")
            seen_keys.add(key)
            objects.append(item)

        truncated = bool(page.get("truncated"))
        next_cursor = page.get("cursor")
        if not truncated:
            break
        if next_cursor is None:
            raise RuntimeError("Manifest R2 truncated tetapi cursor berikutnya kosong.")
        cursor_key = str(next_cursor)
        if cursor_key in seen_cursors:
            raise RuntimeError("Cursor R2 berulang; export dihentikan.")
        seen_cursors.add(cursor_key)
        cursor = next_cursor

    write_json(root / "r2" / "manifest-all.json", {"objects": objects})
    return objects


def download_r2_object(
    base_url: str,
    token: str,
    item: dict[str, Any],
    object_root: Path,
    attempts: int = 5,
) -> dict[str, Any]:
    key = item["key"]
    expected_size = int(item.get("size") or 0)
    key_digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    relative_path = Path("objects-by-key-sha256") / key_digest[:2] / f"{key_digest}.bin"
    target = object_root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)

    url = api_url(base_url, "/api/migration-export/r2/object", {"key": key})
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        temp = target.with_name(f".{target.name}.tmp-{os.getpid()}-{attempt}")
        digest = hashlib.sha256()
        size = 0
        request = Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/octet-stream,*/*",
                "User-Agent": f"TDA-Migration-Exporter/{SCRIPT_VERSION}",
            },
            method="GET",
        )
        try:
            with urlopen(request, timeout=180) as response, temp.open("wb") as handle:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    handle.write(chunk)
                    digest.update(chunk)
                    size += len(chunk)
            if size != expected_size:
                raise RuntimeError(
                    f"Ukuran object berubah untuk {key}: manifest={expected_size}, downloaded={size}"
                )
            os.replace(temp, target)
            return {
                "key": key,
                "manifestSize": expected_size,
                "downloadedSize": size,
                "etag": item.get("etag"),
                "httpEtag": item.get("httpEtag"),
                "uploadedAt": item.get("uploadedAt"),
                "httpMetadata": item.get("httpMetadata"),
                "customMetadata": item.get("customMetadata") or {},
                "sha256": digest.hexdigest(),
                "storedPath": str((Path("r2") / relative_path).as_posix()),
                "status": "ok",
            }
        except HTTPError as exc:
            last_error = exc
            temp.unlink(missing_ok=True)
            if exc.code not in RETRYABLE_STATUS or attempt == attempts:
                raise RuntimeError(f"HTTP {exc.code} saat mengunduh R2 key {key}") from exc
        except (URLError, OSError, RuntimeError) as exc:
            last_error = exc
            temp.unlink(missing_ok=True)
            if attempt == attempts:
                raise
        time.sleep(min(20.0, (2 ** (attempt - 1)) + random.random()))

    raise RuntimeError(f"Gagal mengunduh R2 key {key}: {last_error}")


def export_r2(base_url: str, token: str, root: Path, page_limit: int) -> dict[str, Any]:
    r2_root = root / "r2"
    r2_root.mkdir(parents=True, exist_ok=True)
    objects = list_r2_objects(base_url, token, root, page_limit)
    print(f"[R2] {len(objects)} object ditemukan", flush=True)

    index_path = r2_root / "object-index.ndjson"
    total_bytes = 0
    downloaded = 0
    with index_path.open("w", encoding="utf-8", newline="\n") as index_handle:
        for position, item in enumerate(objects, start=1):
            key = item["key"]
            print(f"[R2 {position}/{len(objects)}] {key}", flush=True)
            record = download_r2_object(base_url, token, item, r2_root)
            total_bytes += int(record["downloadedSize"])
            downloaded += 1
            index_handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
            index_handle.write("\n")

    result = {
        "manifestObjectCount": len(objects),
        "downloadedObjectCount": downloaded,
        "downloadedBytes": total_bytes,
        "allObjectsDownloaded": downloaded == len(objects),
        "objectIndex": str(index_path.relative_to(root)),
    }
    write_json(r2_root / "validation.json", result)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Pull D1 and R2 backup from temporary Sites export bridge.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--token-file", default=DEFAULT_TOKEN_FILE)
    parser.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--page-limit", type=int, default=500)
    args = parser.parse_args()

    if args.page_limit < 1 or args.page_limit > 1000:
        parser.error("--page-limit harus 1-1000")

    os.umask(0o077)
    token_file = Path(args.token_file)
    token = read_token(token_file)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_root = Path(args.output_root)
    snapshot = output_root / f"snapshot-{timestamp}"
    if snapshot.exists():
        snapshot = output_root / f"snapshot-{timestamp}-{random.randrange(1_000_000):06d}"
    snapshot.mkdir(parents=True, exist_ok=False)

    started_at = utc_now()
    write_json(
        snapshot / "snapshot.json",
        {
            "scriptVersion": SCRIPT_VERSION,
            "startedAt": started_at,
            "baseUrl": args.base_url.rstrip("/"),
            "tokenFile": str(token_file),
            "note": "Token content is intentionally never stored in this snapshot.",
        },
    )

    print(f"Snapshot: {snapshot}", flush=True)
    try:
        d1_result = export_d1(args.base_url, token, snapshot, args.page_limit)
        r2_result = export_r2(args.base_url, token, snapshot, args.page_limit)
        validation = {
            "scriptVersion": SCRIPT_VERSION,
            "startedAt": started_at,
            "completedAt": utc_now(),
            "d1": d1_result,
            "r2": r2_result,
            "success": bool(d1_result["allCountsMatch"] and r2_result["allObjectsDownloaded"]),
            "consistencyNote": (
                "This is a read-only live export, not a transactionally frozen cross-table/cross-object snapshot. "
                "A final refresh or short write freeze is still required before production cutover."
            ),
        }
        write_json(snapshot / "validation.json", validation)
        print("Export selesai.", flush=True)
        print(f"Validasi: {snapshot / 'validation.json'}", flush=True)
        if not validation["success"]:
            print("PERINGATAN: ada mismatch validasi; jangan import sebelum diperiksa.", file=sys.stderr)
            return 2
        return 0
    except Exception as exc:
        write_json(
            snapshot / "FAILED.json",
            {"failedAt": utc_now(), "error": str(exc), "scriptVersion": SCRIPT_VERSION},
        )
        print(f"EXPORT GAGAL: {exc}", file=sys.stderr)
        print(f"Snapshot parsial disimpan di: {snapshot}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
