#!/usr/bin/env python3
"""Read-only staging UAT for the VPS migration.

This script logs in through the VPS-local auth endpoint and exercises the main
GET/read paths. It does not create, edit, approve, delete, or upload business
records. Login itself will update VPS auth audit/session tables.
"""

from __future__ import annotations

import getpass
import http.client
import json
import os
import subprocess
import sys
import urllib.parse
from pathlib import Path
from typing import Any

HOST = os.environ.get("TDA_UAT_HOST", "127.0.0.1")
PORT = int(os.environ.get("TDA_UAT_PORT", "3001"))
DEFAULT_EMAIL = "agustrnt@gmail.com"


class UatError(RuntimeError):
    pass


def container_env(name: str, default: str = "") -> str:
    try:
        result = subprocess.run(
            ["docker", "exec", "tda-staging-app", "printenv", name],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip() or default
    except Exception:
        return default


APP_ORIGIN = container_env("APP_ORIGIN", "https://staging.app.tdapekanbaru.id")
ORIGIN_HOST = urllib.parse.urlparse(APP_ORIGIN).netloc or "staging.app.tdapekanbaru.id"


def request(
    method: str,
    path: str,
    *,
    body: bytes | None = None,
    cookie: str | None = None,
    content_type: str | None = None,
) -> tuple[int, dict[str, str], bytes]:
    headers = {
        "Host": ORIGIN_HOST,
        "Origin": APP_ORIGIN,
        "X-Forwarded-Proto": "https",
        "User-Agent": "tda-vps-readonly-uat/1.0",
        "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
    }
    if cookie:
        headers["Cookie"] = cookie
    if content_type:
        headers["Content-Type"] = content_type
    if body is not None:
        headers["Content-Length"] = str(len(body))

    conn = http.client.HTTPConnection(HOST, PORT, timeout=25)
    try:
        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse()
        raw = response.read()
        response_headers: dict[str, str] = {}
        for key, value in response.getheaders():
            lower = key.lower()
            response_headers[lower] = (
                f"{response_headers[lower]}\n{value}"
                if lower in response_headers
                else value
            )
        return response.status, response_headers, raw
    finally:
        conn.close()


def decode_json(raw: bytes) -> Any:
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


def body_excerpt(raw: bytes, limit: int = 280) -> str:
    text = raw.decode("utf-8", errors="replace").replace("\n", " ").strip()
    return text[:limit]


def login(email: str, password: str) -> str:
    form = urllib.parse.urlencode(
        {"email": email, "password": password, "return_to": "/admin"}
    ).encode()
    status, headers, raw = request(
        "POST",
        "/api/auth/login",
        body=form,
        content_type="application/x-www-form-urlencoded",
    )
    if status != 303:
        raise UatError(
            f"Login mengembalikan HTTP {status}: {body_excerpt(raw) or '-'}"
        )
    location = headers.get("location", "")
    if "error=" in location:
        raise UatError(f"Login ditolak: {location}")
    set_cookie = headers.get("set-cookie", "")
    cookie_line = next(
        (line for line in set_cookie.splitlines() if line.startswith("tda_session=")),
        "",
    )
    if not cookie_line:
        raise UatError("Cookie sesi tda_session tidak diterima dari endpoint login.")
    return cookie_line.split(";", 1)[0]


results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}{f' — {detail}' if detail else ''}")


def get_json_test(
    name: str,
    path: str,
    cookie: str | None,
    *,
    expected_status: int = 200,
) -> Any:
    try:
        status, _headers, raw = request("GET", path, cookie=cookie)
        data = decode_json(raw)
        if status != expected_status:
            error = data.get("error") if isinstance(data, dict) else body_excerpt(raw)
            record(name, False, f"HTTP {status}: {error or '-'}")
            return None
        record(name, True, f"HTTP {status}")
        return data
    except Exception as exc:
        record(name, False, str(exc))
        return None


def get_http_test(
    name: str,
    path: str,
    cookie: str | None = None,
    *,
    expected_status: int = 200,
) -> tuple[dict[str, str], bytes] | None:
    try:
        status, headers, raw = request("GET", path, cookie=cookie)
        if status != expected_status:
            record(name, False, f"HTTP {status}: {body_excerpt(raw)}")
            return None
        record(name, True, f"HTTP {status}, {len(raw)} byte")
        return headers, raw
    except Exception as exc:
        record(name, False, str(exc))
        return None


def psql_scalar(sql: str) -> str:
    result = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "tda-staging-postgres",
            "psql",
            "-U",
            "tda_app",
            "-d",
            "tda_staging",
            "-At",
            "-c",
            sql,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def database_checks() -> None:
    checks = {
        "DB programs": ("SELECT COUNT(*) FROM programs;", "61"),
        "DB users": ("SELECT COUNT(*) FROM users;", "13"),
        "DB program_tasks": ("SELECT COUNT(*) FROM program_tasks;", "26"),
        "DB attendance_events": ("SELECT COUNT(*) FROM attendance_events;", "4"),
        "DB attendance_participants": (
            "SELECT COUNT(*) FROM attendance_participants;",
            "122",
        ),
        "DB membership_registrations": (
            "SELECT COUNT(*) FROM membership_registrations;",
            "6",
        ),
        "DB public_media": ("SELECT COUNT(*) FROM public_media;", "2"),
        "DB treasury_accounts": ("SELECT COUNT(*) FROM treasury_accounts;", "3"),
    }
    for name, (sql, expected) in checks.items():
        try:
            actual = psql_scalar(sql)
            record(name, actual == expected, f"{actual} row (snapshot {expected})")
        except Exception as exc:
            record(name, False, str(exc))


def storage_checks() -> None:
    root = Path("/srv/tda-staging/storage/uploads")
    try:
        files = [
            item
            for item in root.rglob("*")
            if item.is_file() and ".tda-metadata" not in item.parts
        ]
        total = sum(item.stat().st_size for item in files)
        ok = len(files) == 13 and total == 8_981_469
        record(
            "Storage R2 lokal",
            ok,
            f"{len(files)} object, {total} byte (snapshot 13 / 8981469)",
        )
    except Exception as exc:
        record("Storage R2 lokal", False, str(exc))


def main() -> int:
    print("TDA Pekanbaru VPS — Read-only UAT")
    print(f"Target lokal : http://{HOST}:{PORT}")
    print(f"APP_ORIGIN   : {APP_ORIGIN}")
    print("Tidak ada create/edit/delete/upload data bisnis dalam tes ini.\n")

    email = input(f"Email login [{DEFAULT_EMAIL}]: ").strip() or DEFAULT_EMAIL
    password = getpass.getpass("Password staging: ")
    try:
        cookie = login(email, password)
        record("Login VPS lokal", True)
    except Exception as exc:
        record("Login VPS lokal", False, str(exc))
        return 2

    access = get_json_test("Akses / identitas", "/api/access/me", cookie)
    if isinstance(access, dict):
        registered = bool(access.get("registered"))
        record("Akun terdaftar di users", registered)

    programs = get_json_test("Program Kerja — daftar", "/api/programs", cookie)
    get_json_test("Program Kerja — dashboard", "/api/program-management/summary", cookie)
    get_json_test("Program Kerja — laporan", "/api/program-management/reports", cookie)
    get_json_test("Program Kerja — kalender", "/api/program-management/calendar", cookie)

    program_id: int | None = None
    program_code: str | None = None
    if isinstance(programs, dict) and isinstance(programs.get("programs"), list):
        rows = programs["programs"]
        record("Jumlah Program Kerja", len(rows) == 61, f"{len(rows)} program (snapshot 61)")
        if rows:
            try:
                program_id = int(rows[0]["id"])
                program_code = str(rows[0].get("programCode") or "")
            except Exception:
                pass
    if program_id:
        base = f"/api/programs/{program_id}"
        get_json_test("Program — detail", base, cookie)
        get_json_test("Program — breakdown pekerjaan", f"{base}/tasks", cookie)
        get_json_test("Program — keuangan & LPJ", f"{base}/finance", cookie)
        get_json_test("Program — evaluasi/KPI", f"{base}/evaluations", cookie)
        get_json_test("Program — feedback", f"{base}/feedback", cookie)
        get_json_test("Program — approval", f"{base}/approval", cookie)
        publication = get_json_test("Program — publikasi", f"{base}/publication", cookie)
        if isinstance(publication, dict):
            item = publication.get("publication") or publication.get("program") or publication
            if isinstance(item, dict):
                public_code = str(item.get("programCode") or program_code or "")
                if item.get("flyerKey") and item.get("isPublished") and public_code:
                    get_http_test(
                        "R2 — flyer program",
                        f"/api/public-programs/{urllib.parse.quote(public_code)}/flyer",
                    )
    else:
        record("Program detail suite", False, "ID program tidak berhasil diambil")

    attendance = get_json_test("Kehadiran / Event", "/api/attendance", cookie)
    membership_admin = get_json_test("Member — pengaturan", "/api/membership", cookie)
    get_json_test("Member — registrasi", "/api/membership?scope=registrations", cookie)
    get_json_test("Bendahara / Buku Besar", "/api/treasury", cookie)
    get_json_test("Master Pengurus", "/api/users", cookie)
    get_json_test("Checklist lama — kategori", "/api/categories", cookie)
    get_json_test("Checklist lama — PIC", "/api/pics", cookie)
    get_json_test("Checklist lama — tugas", "/api/tasks", cookie)
    get_json_test("Checklist lama — aktivitas", "/api/activities", cookie)
    media = get_json_test("Media publik — backoffice", "/api/publication-media", cookie)
    member_public = get_json_test("Member — form publik", "/api/membership/public", None)

    if isinstance(media, dict) and isinstance(media.get("items"), list) and media["items"]:
        media_id = media["items"][0].get("id")
        if media_id:
            get_http_test("R2 — gambar media publik", f"/api/public-media/{media_id}/image")

    if isinstance(member_public, dict):
        settings = member_public.get("settings")
        if isinstance(settings, dict) and settings.get("qrisAvailable"):
            get_http_test("R2 — QRIS member", "/api/membership/public/qris")

    if isinstance(attendance, dict) and isinstance(attendance.get("events"), list):
        for event in attendance["events"]:
            event_id = event.get("id")
            if not event_id:
                continue
            if event.get("flyerKey"):
                get_http_test(
                    "R2 — flyer event",
                    f"/api/public-registration/{event_id}/flyer",
                )
                break
        for event in attendance["events"]:
            event_id = event.get("id")
            if not event_id:
                continue
            if event.get("qrisKey"):
                get_http_test(
                    "R2 — QRIS event",
                    f"/api/public-registration/{event_id}/qris",
                )
                break

    get_http_test("Halaman publik — Beranda", "/")
    get_http_test("Halaman publik — Tentang", "/tentang")
    get_http_test("Halaman publik — Program", "/program")
    get_http_test("Halaman publik — Member", "/member")
    get_http_test("Halaman publik — Kalender", "/kalender")

    database_checks()
    storage_checks()

    passed = sum(1 for _name, ok, _detail in results if ok)
    failed = [item for item in results if not item[1]]
    print("\n=== RINGKASAN ===")
    print(f"PASS: {passed}")
    print(f"FAIL: {len(failed)}")
    if failed:
        print("\nYang masih gagal:")
        for name, _ok, detail in failed:
            print(f"- {name}: {detail}")
        print("\nSTATUS UAT: BELUM LULUS")
        return 1
    print("STATUS UAT: LULUS READ-ONLY")
    return 0


if __name__ == "__main__":
    sys.exit(main())
