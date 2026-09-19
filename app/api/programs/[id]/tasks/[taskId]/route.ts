import {
  PROGRAM_TASK_STATUSES, deleteProgramTask, getProgram, updateProgramTask,
} from "@/db/program-management";
import {
  accessErrorResponse, assertCanManageDivision, requireRegisteredUser,
} from "@/db/access-control";
import { logProgramActivity } from "@/db/program-activity";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const user = await requireRegisteredUser();
    const params = await context.params;
    const programId = parseId(params.id);
    const taskId = parseId(params.taskId);
    if (!programId || !taskId) return Response.json({ error: "ID pekerjaan tidak valid." }, { status: 400 });
    const program = await getProgram(programId);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    if (user.role !== "ketua_ksb" && program.status === "pending_approval") {
      return Response.json({ error: "Breakdown tidak dapat diubah selama menunggu persetujuan." }, { status: 400 });
    }
    const body = await request.json();
    const input = {
      title: String(body.title ?? "").trim(),
      pic: String(body.pic ?? "").trim(),
      dueDate: String(body.dueDate ?? "").trim(),
      status: String(body.status ?? "belum_mulai"),
    notes: String(body.notes ?? "").trim(),
    usesBudget: Boolean(body.usesBudget),
    budgetAmount: Math.max(0, Math.round(Number(body.budgetAmount) || 0)),
    incomeTarget: Math.max(0, Math.round(Number(body.incomeTarget) || 0)),
    assignedDivisionIds: (Array.isArray(body.assignedDivisionIds) ? [...new Set(body.assignedDivisionIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0))] : []) as number[],
    };
    if (!input.title) return Response.json({ error: "Nama pekerjaan wajib diisi." }, { status: 400 });
    if (!PROGRAM_TASK_STATUSES.includes(input.status as typeof PROGRAM_TASK_STATUSES[number])) {
      return Response.json({ error: "Status pekerjaan tidak valid." }, { status: 400 });
    }
    const task = await updateProgramTask(taskId, programId, {
      ...input, status: input.status as typeof PROGRAM_TASK_STATUSES[number],
    });
    if (!task) return Response.json({ error: "Pekerjaan tidak ditemukan." }, { status: 404 });
    await logProgramActivity(user.id, programId, "task_updated", `Memperbarui pekerjaan: ${task.title} (${task.status}).`);
    return Response.json({ task });
  } catch (reason) {
    return accessErrorResponse(reason, "Perubahan pekerjaan belum dapat disimpan.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const user = await requireRegisteredUser();
    const params = await context.params;
    const programId = parseId(params.id);
    const taskId = parseId(params.taskId);
    if (!programId || !taskId) return Response.json({ error: "ID pekerjaan tidak valid." }, { status: 400 });
    const program = await getProgram(programId);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    if (user.role !== "ketua_ksb" && program.status === "pending_approval") {
      return Response.json({ error: "Breakdown tidak dapat diubah selama menunggu persetujuan." }, { status: 400 });
    }
    if (!(await deleteProgramTask(taskId, programId))) {
      return Response.json({ error: "Pekerjaan tidak ditemukan." }, { status: 404 });
    }
    await logProgramActivity(user.id, programId, "task_deleted", `Menghapus pekerjaan #${taskId}.`);
    return Response.json({ ok: true });
  } catch (reason) {
    return accessErrorResponse(reason, "Pekerjaan belum dapat dihapus.");
  }
}
