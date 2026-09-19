import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { deleteProgramEvaluation, updateProgramEvaluation } from "@/db/program-evaluation";
import { logProgramActivity } from "@/db/program-activity";
import { getProgram } from "@/db/program-management";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseInput(body: Record<string, unknown>) {
  return {
    indicator: String(body.indicator ?? "").trim(),
    targetValue: Number(body.targetValue),
    actualValue: Number(body.actualValue ?? 0),
    unit: String(body.unit ?? "").trim(),
    isMeasured: Boolean(body.isMeasured),
    notes: String(body.notes ?? "").trim(),
  };
}

function validateInput(input: ReturnType<typeof parseInput>) {
  if (!input.indicator) return "Indikator keberhasilan wajib diisi.";
  if (input.indicator.length > 240) return "Indikator maksimal 240 karakter.";
  if (!Number.isFinite(input.targetValue) || input.targetValue <= 0) return "Target harus lebih besar dari 0.";
  if (!Number.isFinite(input.actualValue) || input.actualValue < 0) return "Realisasi tidak valid.";
  if (input.unit.length > 60) return "Satuan maksimal 60 karakter.";
  if (input.notes.length > 1000) return "Catatan maksimal 1.000 karakter.";
  return null;
}

async function authorize(programId: number) {
  const user = await requireRegisteredUser();
  const program = await getProgram(programId);
  if (!program) return { error: Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 }) };
  assertCanManageDivision(user, program.divisionId);
  if (user.role !== "ketua_ksb" && program.status === "pending_approval") {
    return { error: Response.json({ error: "Evaluasi tidak dapat diubah selama menunggu persetujuan." }, { status: 400 }) };
  }
  return { user, program };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; evaluationId: string }> }) {
  try {
    const params = await context.params;
    const programId = parseId(params.id);
    const evaluationId = parseId(params.evaluationId);
    if (!programId || !evaluationId) return Response.json({ error: "ID evaluasi tidak valid." }, { status: 400 });
    const access = await authorize(programId);
    if (access.error) return access.error;
    const input = parseInput(await request.json());
    const error = validateInput(input);
    if (error) return Response.json({ error }, { status: 400 });
    const evaluation = await updateProgramEvaluation(evaluationId, programId, input);
    if (!evaluation) return Response.json({ error: "Indikator capaian tidak ditemukan." }, { status: 404 });
    await logProgramActivity(access.user!.id, programId, "evaluation_updated", `Memperbarui capaian: ${input.indicator}.`);
    return Response.json({ evaluation });
  } catch (reason) {
    return accessErrorResponse(reason, "Evaluasi program belum dapat diperbarui.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; evaluationId: string }> }) {
  try {
    const params = await context.params;
    const programId = parseId(params.id);
    const evaluationId = parseId(params.evaluationId);
    if (!programId || !evaluationId) return Response.json({ error: "ID evaluasi tidak valid." }, { status: 400 });
    const access = await authorize(programId);
    if (access.error) return access.error;
    if (!(await deleteProgramEvaluation(evaluationId, programId))) {
      return Response.json({ error: "Indikator capaian tidak ditemukan." }, { status: 404 });
    }
    await logProgramActivity(access.user!.id, programId, "evaluation_deleted", `Menghapus indikator capaian #${evaluationId}.`);
    return Response.json({ ok: true });
  } catch (reason) {
    return accessErrorResponse(reason, "Indikator capaian belum dapat dihapus.");
  }
}
