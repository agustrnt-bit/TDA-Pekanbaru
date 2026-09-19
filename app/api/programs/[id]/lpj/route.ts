import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { LPJ_STATUSES, upsertLpj } from "@/db/program-finance";
import { getProgram } from "@/db/program-management";
import { logProgramActivity, notifyProgramUsers } from "@/db/program-activity";

function idOf(raw: string) { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser(); const id = idOf((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    const body = await request.json(); const status = String(body.status ?? "belum_dibuat");
    if (!LPJ_STATUSES.includes(status as typeof LPJ_STATUSES[number])) return Response.json({ error: "Status LPJ tidak valid." }, { status: 400 });
    if (status === "selesai" && user.role !== "ketua_ksb") return Response.json({ error: "Hanya Ketua/KSB yang dapat menyelesaikan LPJ." }, { status: 403 });
    const lpj = await upsertLpj(id, user.id, { status: status as typeof LPJ_STATUSES[number], summary: String(body.summary ?? "").trim(), result: String(body.result ?? "").trim(), evaluation: String(body.evaluation ?? "").trim() });
    await logProgramActivity(user.id, id, "lpj_updated", `Memperbarui status LPJ menjadi ${status}.`);
    if (status === "diajukan") await notifyProgramUsers(id, "ketua", "lpj", "LPJ menunggu pemeriksaan", `${program.programCode} · ${program.title}`);
    if (status === "selesai") await notifyProgramUsers(id, "division", "lpj_complete", "LPJ selesai", `${program.programCode} · ${program.title}`);
    return Response.json({ lpj });
  } catch (reason) { return accessErrorResponse(reason, "LPJ belum dapat disimpan."); }
}
