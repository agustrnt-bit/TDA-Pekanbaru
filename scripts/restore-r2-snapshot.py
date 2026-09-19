#!/usr/bin/env python3
"""Restore validated R2 snapshot objects into VPS local storage.

Reads the immutable Sites snapshot, verifies every source object's SHA-256 and
size, then restores the original R2 key path plus the metadata sidecar format
expected by lib/vps-cloudflare-workers.ts.

Safety properties:
- never writes outside the configured target root
- validates the snapshot and every source object before writing
- refuses to overwrite an existing target object with different content
- writes via temporary files + atomic replace
- preserves httpMetadata/customMetadata sidecars
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any


def fail(message: str) -> None:
    raise RuntimeError(message)


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        fail(f"File tidak ditemukan: {path}")
        raise exc
    except Exception as exc:
        fail(f"JSON tidak valid: {path}: {exc}")
        raise exc
    if not isinstance(value, dict):
        fail(f"JSON harus berupa object: {path}")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_path(root: Path, key: str) -> Path:
    normalized = key.lstrip("/")
    if not normalized:
        fail("R2 key kosong.")
    candidate = (root / normalized).resolve()
    root_resolved = root.resolve()
    if candidate != root_resolved and root_resolved not in candidate.parents:
        fail(f"R2 key mencoba keluar target root: {key}")
    return candidate


def metadata_path(target_root: Path, key: str) -> Path:
    meta_root = target_root / ".tda-metadata"
    object_meta = safe_path(meta_root, key)
    return Path(str(object_meta) + ".json")


def atomic_copy(source: Path, target: Path, mode: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{target.name}.tmp-", dir=str(target.parent))
    os.close(fd)
    temp = Path(temp_name)
    try:
        shutil.copyfile(source, temp)
        os.chmod(temp, mode)
        os.replace(temp, target)
    finally:
        temp.unlink(missing_ok=True)


def atomic_json(value: dict[str, Any], target: Path, mode: int = 0o600) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{target.name}.tmp-", dir=str(target.parent))
    os.close(fd)
    temp = Path(temp_name)
    try:
        temp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.chmod(temp, mode)
        os.replace(temp, target)
    finally:
        temp.unlink(missing_ok=True)


def load_index(snapshot: Path) -> list[dict[str, Any]]:
    path = snapshot / "r2" / "object-index.ndjson"
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        fail(f"R2 object index tidak ditemukan: {path}")
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except Exception as exc:
            fail(f"NDJSON invalid pada baris {number}: {exc}")
        if not isinstance(record, dict):
            fail(f"Record R2 baris {number} bukan object.")
        key = record.get("key")
        if not isinstance(key, str) or not key:
            fail(f"Record R2 baris {number} tidak punya key valid.")
        if key in seen:
            fail(f"R2 key duplikat di object index: {key}")
        seen.add(key)
        if record.get("status") != "ok":
            fail(f"R2 record tidak berstatus ok: {key}")
        records.append(record)
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore validated Sites R2 snapshot to VPS local storage.")
    parser.add_argument("snapshot", help="Path snapshot Sites yang tervalidasi")
    parser.add_argument("--target", default="/srv/tda-staging/storage/uploads")
    args = parser.parse_args()

    os.umask(0o027)
    snapshot = Path(args.snapshot).resolve()
    target_root = Path(args.target).resolve()

    validation = read_json(snapshot / "validation.json")
    r2_validation = validation.get("r2")
    if validation.get("success") is not True:
        fail("Snapshot tidak berstatus success=true.")
    if not isinstance(r2_validation, dict) or r2_validation.get("allObjectsDownloaded") is not True:
        fail("Snapshot R2 belum tervalidasi lengkap.")

    records = load_index(snapshot)
    expected_count = int(r2_validation.get("downloadedObjectCount") or 0)
    expected_bytes = int(r2_validation.get("downloadedBytes") or 0)
    if len(records) != expected_count:
        fail(f"Jumlah object index berbeda: index={len(records)}, validation={expected_count}")

    print(f"Preflight R2 snapshot: {len(records)} object", flush=True)

    verified_bytes = 0
    prepared: list[tuple[dict[str, Any], Path, Path]] = []
    for position, record in enumerate(records, 1):
        key = str(record["key"])
        stored_path = record.get("storedPath")
        if not isinstance(stored_path, str) or not stored_path:
            fail(f"storedPath tidak valid untuk {key}")
        source = (snapshot / stored_path).resolve()
        if snapshot not in source.parents:
            fail(f"storedPath keluar snapshot: {key}")
        if not source.is_file():
            fail(f"Source object tidak ditemukan: {source}")

        expected_size = int(record.get("downloadedSize") or 0)
        actual_size = source.stat().st_size
        if actual_size != expected_size:
            fail(f"Ukuran source berbeda untuk {key}: expected={expected_size}, actual={actual_size}")
        actual_sha = sha256_file(source)
        expected_sha = str(record.get("sha256") or "")
        if actual_sha != expected_sha:
            fail(f"SHA-256 source berbeda untuk {key}")

        target = safe_path(target_root, key)
        if target.exists():
            if not target.is_file():
                fail(f"Target sudah ada tetapi bukan file: {target}")
            if target.stat().st_size != expected_size or sha256_file(target) != expected_sha:
                fail(f"REFUSE OVERWRITE: target existing berbeda untuk {key}")

        verified_bytes += actual_size
        prepared.append((record, source, target))
        print(f"  [{position}/{len(records)}] verified {key}", flush=True)

    if verified_bytes != expected_bytes:
        fail(f"Total bytes berbeda: verified={verified_bytes}, validation={expected_bytes}")

    print(f"Preflight checksum: OK — {verified_bytes} bytes", flush=True)
    target_root.mkdir(parents=True, exist_ok=True)

    restored = 0
    already_present = 0
    metadata_written = 0

    for position, (record, source, target) in enumerate(prepared, 1):
        key = str(record["key"])
        expected_sha = str(record["sha256"])
        if target.exists() and sha256_file(target) == expected_sha:
            already_present += 1
        else:
            atomic_copy(source, target, 0o640)
            restored += 1

        metadata = {
            "httpMetadata": record.get("httpMetadata") if isinstance(record.get("httpMetadata"), dict) else None,
            "customMetadata": record.get("customMetadata") if isinstance(record.get("customMetadata"), dict) else {},
        }
        # Match adapter behavior: undefined httpMetadata need not be persisted as a null field.
        if metadata["httpMetadata"] is None:
            metadata.pop("httpMetadata")

        meta_target = metadata_path(target_root, key)
        encoded = json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
        if meta_target.exists():
            current = meta_target.read_text(encoding="utf-8")
            try:
                same = json.loads(current) == metadata
            except Exception:
                same = False
            if not same:
                fail(f"REFUSE OVERWRITE: metadata existing berbeda untuk {key}")
        else:
            atomic_json(metadata, meta_target)
            metadata_written += 1

        if target.stat().st_size != int(record.get("downloadedSize") or 0):
            fail(f"Validasi target size gagal setelah restore: {key}")
        if sha256_file(target) != expected_sha:
            fail(f"Validasi target SHA-256 gagal setelah restore: {key}")
        print(f"  [{position}/{len(prepared)}] restored {key}", flush=True)

    print(
        f"RESTORE R2 SELESAI — object={len(prepared)}, baru={restored}, existing-identik={already_present}, metadata-baru={metadata_written}, bytes={verified_bytes}",
        flush=True,
    )
    print(f"Target: {target_root}", flush=True)
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
