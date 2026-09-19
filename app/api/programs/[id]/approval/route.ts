import {
  accessErrorResponse, assertCanManageDivision, requireKetua, requireRegisteredUser,
} from "@/db/access-control";
import {
  getProgram, listProgramApprovals, recordProgramApproval,
} from "@/db/program-management";
import { logProgramActivity, notifyProgramUsers } from "@/db/program-activity";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRegisteredUser();
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    if (!(await getProgram(id))) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    return Response.json({ history: await listProgramApprovals(id) });
  } catch (reason) {
    return accessErrorResponse(reason, "Riwayat persetujuan belum dapat dimuat.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    const body = await request.json();
    const action = String(body.action ?? "");
    const note = String(body.note ?? "").trim();

    if (action === "submit") {
      const actor = await requireRegisteredUser();
      assertCanManageDivision(actor, program.divisionId);
      if (!["draft", "revision_required", "rejected"].includes(program.status)) {
        return Response.json({ error: "Program ini tidak dapat diajukan pada status sekarang." }, { status: 400 });
      }
      const updated = await recordProgramApproval(id, actor.id, "submitted", note, "pending_approval");
      await logProgramActivity(actor.id, id, "approval_submitted", `Mengajukan ${program.programCode} untuk persetujuan.`);
      await notifyProgramUsers(id, "ketua", "approval", "Program menunggu persetujuan", `${program.programCode} · ${program.title}`);
      return Response.json({ program: updated, history: await listProgramApprovals(id) });
    }

    const actor = await requireKetua();
    if (program.status !== "pending_approval") {
      return Response.json({ error: "Program ini tidak sedang menunggu persetujuan." }, { status: 400 });
    }
    if (action === "approve") {
      const updated = await recordProgramApproval(id, actor.id, "approved", note, "approved");
      await logProgramActivity(actor.id, id, "approved", `Menyetujui ${program.programCode}.`); await notifyProgramUsers(id, "division", "approved", "Program disetujui", `${program.programCode} · ${program.title}`);
      return Response.json({ program: updated, history: await listProgramApprovals(id) });
    }
    if (action === "request_revision") {
      if (!note) return Response.json({ error: "Catatan revisi wajib diisi." }, { status: 400 });
      const updated = await recordProgramApproval(id, actor.id, "revision_required", note, "revision_required");
      await logProgramActivity(actor.id, id, "revision_required", `Meminta revisi ${program.programCode}: ${note}`); await notifyProgramUsers(id, "division", "revision", "Program perlu revisi", `${program.programCode} · ${note}`);
      return Response.json({ program: updated, history: await listProgramApprovals(id) });
    }
    if (action === "reject") {
      if (!note) return Response.json({ error: "Alasan penolakan wajib diisi." }, { status: 400 });
      const updated = await recordProgramApproval(id, actor.id, "rejected", note, "rejected");
      await logProgramActivity(actor.id, id, "rejected", `Menolak ${program.programCode}: ${note}`); await notifyProgramUsers(id, "division", "rejected", "Program ditolak", `${program.programCode} · ${note}`);
      return Response.json({ program: updated, history: await listProgramApprovals(id) });
    }
    return Response.json({ error: "Aksi persetujuan tidak valid." }, { status: 400 });
  } catch (reason) {
    return accessErrorResponse(reason, "Keputusan persetujuan belum dapat disimpan.");
  }
}
