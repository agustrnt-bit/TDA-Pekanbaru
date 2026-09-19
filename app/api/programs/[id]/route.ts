import {
  deleteProgram, divisionExists, getProgram, updateProgram,
} from "@/db/program-management";
import { deleteReceiptKeys, listProgramReceiptKeys } from "@/db/program-finance";
import { logProgramActivity } from "@/db/program-activity";
import {
  accessErrorResponse, assertCanManageDivision, requireRegisteredUser,
} from "@/db/access-control";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRegisteredUser();
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    return Response.json({ program });
  } catch (reason) {
    return accessErrorResponse(reason, "Detail program kerja belum dapat dimuat.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser();
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const body = await request.json();
    const divisionId = Number(body.divisionId);
    const title = String(body.title ?? "").trim();
    const summary = String(body.summary ?? "").trim();
    const pic = String(body.pic ?? "").trim();
    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();
    const target = String(body.target ?? "").trim();
    const budget = Math.max(0, Math.round(Number(body.budget) || 0));
    if (!title || !Number.isInteger(divisionId) || divisionId < 1) {
      return Response.json({ error: "Nama program dan divisi wajib diisi." }, { status: 400 });
    }
    if (startDate && endDate && endDate < startDate) {
      return Response.json({ error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." }, { status: 400 });
    }
    if (!(await divisionExists(divisionId))) {
      return Response.json({ error: "Divisi tidak ditemukan atau sudah tidak aktif." }, { status: 400 });
    }
    const existing = await getProgram(id);
    if (!existing) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, existing.divisionId);
    assertCanManageDivision(user, divisionId);
    if (user.role !== "ketua_ksb" && ["pending_approval", "approved"].includes(existing.status)) {
      return Response.json({ error: "Program yang sedang diproses atau sudah disetujui tidak dapat diedit." }, { status: 400 });
    }
    const program = await updateProgram(id, {
      divisionId, title, summary, pic, startDate, endDate, target, budget,
      status: existing.status,
    });
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    await logProgramActivity(user.id, id, "program_updated", `Memperbarui ${program.programCode} · ${program.title}.`);
    return Response.json({ program });
  } catch (reason) {
    return accessErrorResponse(reason, "Perubahan program kerja belum dapat disimpan.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser();
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const existing = await getProgram(id);
    if (!existing) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, existing.divisionId);
    if (user.role !== "ketua_ksb" && ["pending_approval", "approved"].includes(existing.status)) {
      return Response.json({ error: "Program yang sedang diproses atau sudah disetujui tidak dapat dihapus." }, { status: 400 });
    }
    const receiptKeys = await listProgramReceiptKeys(id);
    await logProgramActivity(user.id, id, "program_deleted", `Menghapus ${existing.programCode} · ${existing.title}.`);
    if (!(await deleteProgram(id))) {
      return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    }
    await deleteReceiptKeys(receiptKeys).catch(() => undefined);
    return Response.json({ ok: true });
  } catch (reason) {
    return accessErrorResponse(reason, "Program kerja belum dapat dihapus.");
  }
}
