#!/usr/bin/env python3
"""Controlled write UAT for TDA Pekanbaru VPS staging.

The test creates uniquely-marked temporary records through the application APIs,
verifies CRUD and local object storage behavior, then removes the temporary data.
It is intended for staging only. A database/storage checkpoint should exist before
running it.

The script never touches pre-existing business rows. Login does update the VPS
auth session/audit tables. PostgreSQL identity sequences may advance, which is
normal and does not alter existing business records.
"""

from __future__ import annotations

import base64
import datetime as dt
import getpass
import http.client
import json
import os
import secrets
import subprocess
import sys
import urllib.parse
from pathlib import Path
from typing import Any

HOST = os.environ.get("TDA_UAT_HOST", "127.0.0.1")
PORT = int(os.environ.get("TDA_UAT_PORT", "3001"))
DEFAULT_EMAIL = "agustrnt@gmail.com"
STORAGE_ROOT = Path("/srv/tda-staging/storage/uploads")
METADATA_ROOT = STORAGE_ROOT / ".tda-metadata"

# Valid 1x1 PNG. Small enough for repeatable storage write/delete testing.
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zf5sAAAAASUVORK5CYII="
)


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
        "User-Agent": "tda-vps-write-uat/1.0",
        "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
    }
    if cookie:
        headers["Cookie"] = cookie
    if content_type:
        headers["Content-Type"] = content_type
    if body is not None:
        headers["Content-Length"] = str(len(body))

    conn = http.client.HTTPConnection(HOST, PORT, timeout=30)
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


def body_excerpt(raw: bytes, limit: int = 300) -> str:
    return raw.decode("utf-8", errors="replace").replace("\n", " ").strip()[:limit]


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
        raise UatError(f"Login HTTP {status}: {body_excerpt(raw) or '-'}")
    location = headers.get("location", "")
    if "error=" in location:
        raise UatError(f"Login ditolak: {location}")
    set_cookie = headers.get("set-cookie", "")
    cookie_line = next(
        (line for line in set_cookie.splitlines() if line.startswith("tda_session=")),
        "",
    )
    if not cookie_line:
        raise UatError("Cookie sesi tda_session tidak diterima.")
    return cookie_line.split(";", 1)[0]


def multipart(
    fields: dict[str, Any],
    files: dict[str, tuple[str, str, bytes]] | None = None,
) -> tuple[bytes, str]:
    boundary = f"----TDAUAT{secrets.token_hex(16)}"
    out = bytearray()
    for name, value in fields.items():
        out.extend(f"--{boundary}\r\n".encode())
        out.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        if isinstance(value, bool):
            text = "true" if value else "false"
        elif value is None:
            text = ""
        else:
            text = str(value)
        out.extend(text.encode("utf-8"))
        out.extend(b"\r\n")
    for name, (filename, content_type, content) in (files or {}).items():
        out.extend(f"--{boundary}\r\n".encode())
        out.extend(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        out.extend(f"Content-Type: {content_type}\r\n\r\n".encode())
        out.extend(content)
        out.extend(b"\r\n")
    out.extend(f"--{boundary}--\r\n".encode())
    return bytes(out), f"multipart/form-data; boundary={boundary}"


results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{f' — {detail}' if detail else ''}")


def must_json(
    name: str,
    method: str,
    path: str,
    cookie: str,
    *,
    expected: int | tuple[int, ...] = 200,
    payload: dict[str, Any] | None = None,
    form_fields: dict[str, Any] | None = None,
    files: dict[str, tuple[str, str, bytes]] | None = None,
) -> Any:
    if payload is not None and form_fields is not None:
        raise ValueError("payload dan form_fields tidak boleh dipakai bersamaan")
    body: bytes | None = None
    content_type: str | None = None
    if payload is not None:
        body = json.dumps(payload, separators=(",", ":")).encode()
        content_type = "application/json"
    elif form_fields is not None:
        body, content_type = multipart(form_fields, files)
    status, _headers, raw = request(
        method, path, body=body, cookie=cookie, content_type=content_type
    )
    expected_set = {expected} if isinstance(expected, int) else set(expected)
    data = decode_json(raw)
    if status not in expected_set:
        error = data.get("error") if isinstance(data, dict) else body_excerpt(raw)
        record(name, False, f"HTTP {status}: {error or '-'}")
        raise UatError(f"{name} gagal")
    record(name, True, f"HTTP {status}")
    return data


def must_http(
    name: str,
    method: str,
    path: str,
    cookie: str | None = None,
    *,
    expected: int = 200,
) -> bytes:
    status, _headers, raw = request(method, path, cookie=cookie)
    if status != expected:
        record(name, False, f"HTTP {status}: {body_excerpt(raw)}")
        raise UatError(f"{name} gagal")
    record(name, True, f"HTTP {status}, {len(raw)} byte")
    return raw


def psql_scalar(sql: str) -> str:
    result = subprocess.run(
        [
            "docker", "exec", "-i", "tda-staging-postgres", "psql",
            "-U", "tda_app", "-d", "tda_staging", "-At", "-c", sql,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def psql_exec(sql: str) -> None:
    subprocess.run(
        [
            "docker", "exec", "-i", "tda-staging-postgres", "psql",
            "-U", "tda_app", "-d", "tda_staging", "-v", "ON_ERROR_STOP=1",
            "-q", "-c", sql,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def storage_stats() -> tuple[int, int]:
    files = [
        item for item in STORAGE_ROOT.rglob("*")
        if item.is_file() and ".tda-metadata" not in item.parts
    ]
    return len(files), sum(item.stat().st_size for item in files)


def safe_storage_path(root: Path, key: str) -> Path:
    candidate = (root / key.lstrip("/")).resolve()
    root_resolved = root.resolve()
    if candidate != root_resolved and root_resolved not in candidate.parents:
        raise UatError("Object key cleanup tidak aman")
    return candidate


def cleanup_object(key: str | None) -> None:
    if not key:
        return
    for path in (
        safe_storage_path(STORAGE_ROOT, key),
        Path(str(safe_storage_path(METADATA_ROOT, key)) + ".json"),
    ):
        try:
            path.unlink()
        except FileNotFoundError:
            pass


def row_count(table: str) -> int:
    allowed = {
        "programs", "program_tasks", "program_evaluations", "program_expenses",
        "program_incomes", "program_feedback_questions", "program_lpj",
        "program_publications", "attendance_events", "public_media",
        "treasury_transactions",
    }
    if table not in allowed:
        raise ValueError(table)
    return int(psql_scalar(f'SELECT COUNT(*) FROM "{table}";'))


def main() -> int:
    print("TDA Pekanbaru VPS — Controlled Write UAT")
    print(f"Target lokal : http://{HOST}:{PORT}")
    print(f"APP_ORIGIN   : {APP_ORIGIN}")
    print("Membuat data dummy berpenanda unik, lalu membersihkannya kembali.\n")

    email = input(f"Email login [{DEFAULT_EMAIL}]: ").strip() or DEFAULT_EMAIL
    password = getpass.getpass("Password staging: ")
    marker = f"UAT-WRITE-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{secrets.token_hex(3)}"
    today = dt.date.today().isoformat()

    cookie = ""
    program_id: int | None = None
    task_id: int | None = None
    evaluation_id: int | None = None
    expense_id: int | None = None
    income_id: int | None = None
    event_id: int | None = None
    media_id: int | None = None
    treasury_id: int | None = None
    feedback_question_id: int | None = None
    object_keys: set[str] = set()

    tables = [
        "programs", "program_tasks", "program_evaluations", "program_expenses",
        "program_incomes", "program_feedback_questions", "program_lpj",
        "program_publications", "attendance_events", "public_media",
        "treasury_transactions",
    ]
    baseline_counts: dict[str, int] = {}
    baseline_storage = (0, 0)
    test_error: Exception | None = None

    try:
        cookie = login(email, password)
        record("Login VPS lokal", True)

        baseline_counts = {table: row_count(table) for table in tables}
        baseline_storage = storage_stats()
        record(
            "Baseline staging",
            True,
            f"{sum(baseline_counts.values())} row pada tabel uji; storage {baseline_storage[0]} object",
        )

        summary = must_json(
            "Preflight divisi", "GET", "/api/program-management/summary", cookie
        )
        divisions = summary.get("divisions", []) if isinstance(summary, dict) else []
        if not divisions:
            raise UatError("Tidak ada divisi aktif untuk membuat program dummy")
        division_id = int(divisions[0]["id"])

        treasury = must_json("Preflight rekening", "GET", "/api/treasury", cookie)
        accounts = treasury.get("accounts", []) if isinstance(treasury, dict) else []
        if not accounts:
            raise UatError("Tidak ada rekening aktif untuk UAT transaksi")
        account_id = int(accounts[0]["id"])

        created = must_json(
            "Program — tambah dummy", "POST", "/api/programs", cookie,
            expected=201,
            payload={
                "divisionId": division_id,
                "title": marker,
                "summary": "Data sementara untuk UAT migrasi VPS",
                "pic": "UAT",
                "startDate": today,
                "endDate": today,
                "target": "Validasi write path PostgreSQL",
                "budget": 100000,
                "status": "draft",
            },
        )
        program = created.get("program") if isinstance(created, dict) else None
        if not isinstance(program, dict) or not program.get("id"):
            raise UatError("ID program dummy tidak diterima")
        program_id = int(program["id"])

        must_json(
            "Program — edit dummy", "PATCH", f"/api/programs/{program_id}", cookie,
            payload={
                "divisionId": division_id,
                "title": f"{marker} UPDATED",
                "summary": "Edit sementara untuk UAT migrasi VPS",
                "pic": "UAT",
                "startDate": today,
                "endDate": today,
                "target": "Validasi update PostgreSQL",
                "budget": 125000,
            },
        )

        task_created = must_json(
            "Breakdown — tambah", "POST", f"/api/programs/{program_id}/tasks", cookie,
            expected=201,
            payload={
                "title": f"{marker} TASK",
                "pic": "UAT",
                "dueDate": today,
                "status": "belum_mulai",
                "notes": "Task sementara",
                "usesBudget": True,
                "budgetAmount": 50000,
                "incomeTarget": 75000,
                "assignedDivisionIds": [],
            },
        )
        task = task_created.get("task") if isinstance(task_created, dict) else None
        if not isinstance(task, dict) or not task.get("id"):
            raise UatError("ID task dummy tidak diterima")
        task_id = int(task["id"])

        must_json(
            "Breakdown — edit", "PATCH",
            f"/api/programs/{program_id}/tasks/{task_id}", cookie,
            payload={
                "title": f"{marker} TASK UPDATED",
                "pic": "UAT",
                "dueDate": today,
                "status": "proses",
                "notes": "Task edit sementara",
                "usesBudget": True,
                "budgetAmount": 60000,
                "incomeTarget": 80000,
                "assignedDivisionIds": [],
            },
        )

        evaluation_created = must_json(
            "KPI — tambah", "POST", f"/api/programs/{program_id}/evaluations", cookie,
            expected=201,
            payload={
                "indicator": f"{marker} KPI",
                "targetValue": 10,
                "actualValue": 5,
                "unit": "unit",
                "isMeasured": True,
                "notes": "KPI sementara",
            },
        )
        evaluation = evaluation_created.get("evaluation") if isinstance(evaluation_created, dict) else None
        if not isinstance(evaluation, dict) or not evaluation.get("id"):
            raise UatError("ID KPI dummy tidak diterima")
        evaluation_id = int(evaluation["id"])

        must_json(
            "KPI — edit", "PATCH",
            f"/api/programs/{program_id}/evaluations/{evaluation_id}", cookie,
            payload={
                "indicator": f"{marker} KPI UPDATED",
                "targetValue": 10,
                "actualValue": 10,
                "unit": "unit",
                "isMeasured": True,
                "notes": "KPI edit sementara",
            },
        )
        must_json(
            "KPI — hapus", "DELETE",
            f"/api/programs/{program_id}/evaluations/{evaluation_id}", cookie,
        )
        evaluation_id = None

        feedback = must_json(
            "Feedback — tambah pertanyaan", "POST",
            f"/api/programs/{program_id}/feedback", cookie,
            expected=201,
            payload={
                "question": f"{marker} feedback?",
                "questionType": "text",
                "options": [],
                "isRequired": False,
            },
        )
        questions = feedback.get("questions", []) if isinstance(feedback, dict) else []
        match = next(
            (q for q in questions if isinstance(q, dict) and q.get("question") == f"{marker} feedback?"),
            None,
        )
        if not match or not match.get("id"):
            raise UatError("ID pertanyaan feedback dummy tidak ditemukan")
        feedback_question_id = int(match["id"])
        must_json(
            "Feedback — hapus pertanyaan", "DELETE",
            f"/api/programs/{program_id}/feedback?questionId={feedback_question_id}", cookie,
        )
        feedback_question_id = None

        must_json(
            "LPJ — simpan", "PATCH", f"/api/programs/{program_id}/lpj", cookie,
            payload={
                "status": "proses",
                "summary": marker,
                "result": "UAT",
                "evaluation": "UAT sementara",
            },
        )

        must_json(
            "Publikasi program — simpan", "PATCH",
            f"/api/programs/{program_id}/publication", cookie,
            form_fields={
                "isPublished": False,
                "publicTitle": f"{marker} PUBLIC",
                "tagline": "UAT",
                "description": "UAT sementara",
                "benefits": "UAT",
                "audience": "UAT",
                "contactName": "UAT",
                "contactPhone": "628000000000",
                "registrationEventId": "",
                "isFeatured": False,
            },
        )

        expense_created = must_json(
            "Keuangan — tambah pengeluaran + upload", "POST",
            f"/api/programs/{program_id}/finance", cookie,
            expected=201,
            form_fields={
                "description": f"{marker} EXPENSE",
                "category": "UAT",
                "expenseDate": today,
                "amount": 12345,
                "treasuryAccountId": account_id,
                "taskId": task_id,
            },
            files={"receipt": ("uat-expense.png", "image/png", PNG_BYTES)},
        )
        expense = expense_created.get("expense") if isinstance(expense_created, dict) else None
        if not isinstance(expense, dict) or not expense.get("id"):
            raise UatError("ID pengeluaran dummy tidak diterima")
        expense_id = int(expense["id"])
        expense_key = str(expense.get("receiptKey") or "")
        if expense_key:
            object_keys.add(expense_key)
            exists = safe_storage_path(STORAGE_ROOT, expense_key).is_file()
            record("Storage — bukti pengeluaran tersimpan", exists, expense_key if exists else "file tidak ditemukan")
            if not exists:
                raise UatError("Bukti pengeluaran tidak tersimpan di storage lokal")

        must_json(
            "Keuangan — edit pengeluaran", "PATCH",
            f"/api/programs/{program_id}/finance/{expense_id}", cookie,
            payload={
                "description": f"{marker} EXPENSE UPDATED",
                "category": "UAT",
                "expenseDate": today,
                "amount": 23456,
            },
        )
        must_json(
            "Keuangan — hapus pengeluaran", "DELETE",
            f"/api/programs/{program_id}/finance/{expense_id}", cookie,
        )
        expense_id = None
        if expense_key:
            removed = not safe_storage_path(STORAGE_ROOT, expense_key).exists()
            record("Storage — bukti pengeluaran terhapus", removed)
            if not removed:
                raise UatError("File bukti pengeluaran masih tertinggal")
            object_keys.discard(expense_key)

        income_created = must_json(
            "Keuangan — tambah penerimaan + upload", "POST",
            f"/api/programs/{program_id}/income", cookie,
            expected=201,
            form_fields={
                "description": f"{marker} INCOME",
                "source": "UAT",
                "incomeDate": today,
                "amount": 34567,
                "treasuryAccountId": account_id,
                "taskId": task_id,
            },
            files={"receipt": ("uat-income.png", "image/png", PNG_BYTES)},
        )
        income = income_created.get("income") if isinstance(income_created, dict) else None
        if not isinstance(income, dict) or not income.get("id"):
            raise UatError("ID penerimaan dummy tidak diterima")
        income_id = int(income["id"])
        income_key = str(income.get("receiptKey") or "")
        if income_key:
            object_keys.add(income_key)
            exists = safe_storage_path(STORAGE_ROOT, income_key).is_file()
            record("Storage — bukti penerimaan tersimpan", exists)
            if not exists:
                raise UatError("Bukti penerimaan tidak tersimpan di storage lokal")
        must_json(
            "Keuangan — hapus penerimaan", "DELETE",
            f"/api/programs/{program_id}/income/{income_id}", cookie,
        )
        income_id = None
        if income_key:
            removed = not safe_storage_path(STORAGE_ROOT, income_key).exists()
            record("Storage — bukti penerimaan terhapus", removed)
            if not removed:
                raise UatError("File bukti penerimaan masih tertinggal")
            object_keys.discard(income_key)

        event_created = must_json(
            "Event — tambah", "POST", "/api/attendance", cookie,
            expected=201,
            payload={
                "action": "event",
                "programId": program_id,
                "name": f"{marker} EVENT",
                "publicTitle": f"{marker} EVENT",
                "collaborationPartner": "",
                "isCollaboration": False,
                "eventDate": today,
                "startTime": "09:00",
                "endTime": "10:00",
                "location": "UAT VPS",
            },
        )
        if not isinstance(event_created, dict) or not event_created.get("id"):
            raise UatError("ID event dummy tidak diterima")
        event_id = int(event_created["id"])
        must_json(
            "Event — hapus", "POST", "/api/attendance", cookie,
            payload={"action": "delete-event", "eventId": event_id},
        )
        event_id = None

        must_json(
            "Bendahara — tambah transaksi manual", "POST", "/api/treasury", cookie,
            expected=201,
            payload={
                "action": "manual",
                "accountId": account_id,
                "direction": "income",
                "description": f"{marker} TREASURY",
                "category": "UAT",
                "transactionDate": today,
                "amount": 1111,
            },
        )
        treasury_after = must_json(
            "Bendahara — baca transaksi dummy", "GET", "/api/treasury", cookie
        )
        mutations = treasury_after.get("mutations", []) if isinstance(treasury_after, dict) else []
        mutation = next(
            (
                row for row in mutations
                if isinstance(row, dict) and row.get("description") == f"{marker} TREASURY"
            ),
            None,
        )
        if not mutation or not mutation.get("sourceId"):
            raise UatError("Transaksi bendahara dummy tidak ditemukan kembali")
        treasury_id = int(mutation["sourceId"])
        must_json(
            "Bendahara — edit transaksi manual", "POST", "/api/treasury", cookie,
            payload={
                "action": "update-manual",
                "id": treasury_id,
                "accountId": account_id,
                "direction": "income",
                "description": f"{marker} TREASURY UPDATED",
                "category": "UAT",
                "transactionDate": today,
                "amount": 2222,
            },
        )
        must_json(
            "Bendahara — hapus transaksi manual", "POST", "/api/treasury", cookie,
            payload={"action": "delete-manual", "id": treasury_id},
        )
        treasury_id = None

        media_created = must_json(
            "Media publik — tambah + upload", "POST", "/api/publication-media", cookie,
            expected=201,
            form_fields={
                "mediaType": "gallery",
                "title": f"{marker} MEDIA",
                "description": "Media dummy UAT",
                "eventDate": today,
                "linkUrl": "",
                "sortOrder": 9999,
                "isActive": True,
            },
            files={"image": ("uat-media.png", "image/png", PNG_BYTES)},
        )
        if not isinstance(media_created, dict) or not media_created.get("id"):
            raise UatError("ID media dummy tidak diterima")
        media_id = int(media_created["id"])
        media_key = psql_scalar(
            f"SELECT COALESCE(image_key, '') FROM public_media WHERE id = {media_id};"
        )
        if media_key:
            object_keys.add(media_key)
            exists = safe_storage_path(STORAGE_ROOT, media_key).is_file()
            record("Storage — media publik tersimpan", exists, media_key if exists else "")
            if not exists:
                raise UatError("Media publik tidak tersimpan di storage")
        must_http(
            "Media publik — baca file", "GET", f"/api/public-media/{media_id}/image"
        )
        must_json(
            "Media publik — edit", "PATCH", f"/api/publication-media/{media_id}", cookie,
            payload={
                "mediaType": "gallery",
                "title": f"{marker} MEDIA UPDATED",
                "description": "Media dummy UAT updated",
                "eventDate": today,
                "linkUrl": "",
                "sortOrder": 9998,
                "isActive": True,
            },
        )
        must_json(
            "Media publik — hapus", "DELETE", f"/api/publication-media/{media_id}", cookie
        )
        media_id = None
        if media_key:
            removed = not safe_storage_path(STORAGE_ROOT, media_key).exists()
            record("Storage — media publik terhapus", removed)
            if not removed:
                raise UatError("File media publik masih tertinggal")
            object_keys.discard(media_key)

        must_json(
            "Breakdown — hapus", "DELETE",
            f"/api/programs/{program_id}/tasks/{task_id}", cookie,
        )
        task_id = None

        must_json(
            "Program — hapus dummy", "DELETE", f"/api/programs/{program_id}", cookie
        )
        program_id = None

    except Exception as exc:
        test_error = exc
        if not any(not ok for _name, ok, _detail in results):
            record("Write UAT", False, str(exc))
    finally:
        # Collect any keys still referenced by uniquely-marked temporary rows.
        try:
            marker_sql = sql_literal(marker + "%")
            for query in (
                f"SELECT COALESCE(receipt_key, '') FROM program_expenses WHERE description LIKE {marker_sql};",
                f"SELECT COALESCE(receipt_key, '') FROM program_incomes WHERE description LIKE {marker_sql};",
                f"SELECT COALESCE(image_key, '') FROM public_media WHERE title LIKE {marker_sql};",
            ):
                output = psql_scalar(query)
                for key in output.splitlines():
                    if key.strip():
                        object_keys.add(key.strip())
        except Exception:
            pass

        # Emergency cleanup is intentionally scoped to the unique marker / IDs.
        try:
            marker_literal = sql_literal(marker + "%")
            statements = [
                f"DELETE FROM treasury_transactions WHERE description LIKE {marker_literal}",
                f"DELETE FROM public_media WHERE title LIKE {marker_literal}",
                f"DELETE FROM attendance_events WHERE name LIKE {marker_literal}",
            ]
            if program_id:
                pid = int(program_id)
                statements.extend([
                    f"DELETE FROM notifications WHERE program_id = {pid}",
                    f"DELETE FROM program_feedback_answers WHERE submission_id IN (SELECT id FROM program_feedback_submissions WHERE program_id = {pid})",
                    f"DELETE FROM program_feedback_submissions WHERE program_id = {pid}",
                    f"DELETE FROM program_feedback_questions WHERE program_id = {pid}",
                    f"DELETE FROM program_task_divisions WHERE task_id IN (SELECT id FROM program_tasks WHERE program_id = {pid})",
                    f"DELETE FROM program_approvals WHERE program_id = {pid}",
                    f"DELETE FROM program_expenses WHERE program_id = {pid}",
                    f"DELETE FROM program_incomes WHERE program_id = {pid}",
                    f"DELETE FROM program_evaluations WHERE program_id = {pid}",
                    f"DELETE FROM program_lpj WHERE program_id = {pid}",
                    f"DELETE FROM attendance_events WHERE program_id = {pid}",
                    f"DELETE FROM program_tasks WHERE program_id = {pid}",
                    f"DELETE FROM program_publications WHERE program_id = {pid}",
                    f"DELETE FROM programs WHERE id = {pid}",
                    f"DELETE FROM activity_logs WHERE entity_type = 'program' AND entity_id = {sql_literal(str(pid))}",
                ])
            # Also clean activity logs after a successful API program delete.
            statements.append(
                f"DELETE FROM activity_logs WHERE entity_type = 'program' AND description LIKE {sql_literal('%' + marker + '%')}"
            )
            psql_exec("BEGIN; " + "; ".join(statements) + "; COMMIT;")
        except Exception as cleanup_exc:
            record("Cleanup database dummy", False, str(cleanup_exc))
            if test_error is None:
                test_error = cleanup_exc

        for key in list(object_keys):
            try:
                cleanup_object(key)
            except Exception as cleanup_exc:
                record("Cleanup object dummy", False, f"{key}: {cleanup_exc}")
                if test_error is None:
                    test_error = cleanup_exc

        if baseline_counts:
            try:
                mismatches = []
                for table, before in baseline_counts.items():
                    after = row_count(table)
                    if after != before:
                        mismatches.append(f"{table} {before}->{after}")
                current_storage = storage_stats()
                if current_storage != baseline_storage:
                    mismatches.append(
                        f"storage {baseline_storage[0]}/{baseline_storage[1]} -> {current_storage[0]}/{current_storage[1]}"
                    )
                if mismatches:
                    record("Cleanup & baseline kembali", False, "; ".join(mismatches))
                    if test_error is None:
                        test_error = UatError("Baseline staging belum kembali")
                else:
                    record(
                        "Cleanup & baseline kembali",
                        True,
                        f"storage {current_storage[0]} object / {current_storage[1]} byte",
                    )
            except Exception as cleanup_exc:
                record("Verifikasi cleanup", False, str(cleanup_exc))
                if test_error is None:
                    test_error = cleanup_exc

    passed = sum(1 for _name, ok, _detail in results if ok)
    failed = [item for item in results if not item[1]]
    print("\n=== RINGKASAN WRITE UAT ===")
    print(f"PASS: {passed}")
    print(f"FAIL: {len(failed)}")
    if failed:
        print("\nYang masih gagal:")
        for name, _ok, detail in failed:
            print(f"- {name}: {detail}")
        print("STATUS WRITE UAT: BELUM LULUS")
        return 1
    if test_error:
        print(f"STATUS WRITE UAT: BELUM LULUS — {test_error}")
        return 1
    print("STATUS WRITE UAT: LULUS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
