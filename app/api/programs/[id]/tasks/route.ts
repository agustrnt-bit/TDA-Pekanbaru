import {
  PROGRAM_TASK_STATUSES, createProgramTask, getProgram, listProgramTasks,
} from "@/db/program-management";
import {
  accessErrorResponse, assertCanManageDivision, requireRegisteredUser,
} from "@/db/access-control";
import { logProgramActivity } from "@/db/program-activity";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseInput(body: Record<string, unknown>) {
  return {
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
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRegisteredUser();
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    if (!(await getProgram(id))) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    return Response.json({ tasks: await listProgramTasks(id) });
  } catch (reason) {
    return accessErrorResponse(reason, "Breakdown pekerjaan belum dapat dimuat.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser();
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    if (user.role !== "ketua_ksb" && program.status === "pending_approval") {
      return Response.json({ error: "Breakdown tidak dapat diubah selama menunggu persetujuan." }, { status: 400 });
    }
    const input = parseInput(await request.json());
    if (!input.title) return Response.json({ error: "Nama pekerjaan wajib diisi." }, { status: 400 });
    if (!PROGRAM_TASK_STATUSES.includes(input.status as typeof PROGRAM_TASK_STATUSES[number])) {
      return Response.json({ error: "Status pekerjaan tidak valid." }, { status: 400 });
    }
    const task = await createProgramTask(id, {
      ...input, status: input.status as typeof PROGRAM_TASK_STATUSES[number],
    });
    await logProgramActivity(user.id, id, "task_created", `Menambahkan pekerjaan: ${task?.title ?? input.title}.`);
    return Response.json({ task }, { status: 201 });
  } catch (reason) {
    return accessErrorResponse(reason, "Pekerjaan belum dapat ditambahkan.");
  }
}
