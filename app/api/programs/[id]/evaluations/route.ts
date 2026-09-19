import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { createProgramEvaluation, listProgramEvaluations } from "@/db/program-evaluation";
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

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRegisteredUser();
    const programId = parseId((await context.params).id);
    if (!programId) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    if (!(await getProgram(programId))) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    return Response.json({ evaluations: await listProgramEvaluations(programId) });
  } catch (reason) {
    return accessErrorResponse(reason, "Evaluasi program belum dapat dimuat.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser();
    const programId = parseId((await context.params).id);
    if (!programId) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(programId);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    if (user.role !== "ketua_ksb" && program.status === "pending_approval") {
      return Response.json({ error: "Evaluasi tidak dapat diubah selama menunggu persetujuan." }, { status: 400 });
    }
    const input = parseInput(await request.json());
    const error = validateInput(input);
    if (error) return Response.json({ error }, { status: 400 });
    const evaluation = await createProgramEvaluation(programId, user.id, input);
    await logProgramActivity(user.id, programId, "evaluation_created", `Menambahkan indikator capaian: ${input.indicator}.`);
    return Response.json({ evaluation }, { status: 201 });
  } catch (reason) {
    return accessErrorResponse(reason, "Indikator capaian belum dapat ditambahkan.");
  }
}
