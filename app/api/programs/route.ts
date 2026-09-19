import {
  createProgram, divisionExists, listPrograms,
} from "@/db/program-management";
import {
  accessErrorResponse, assertCanManageDivision, requireRegisteredUser,
} from "@/db/access-control";
import { logProgramActivity } from "@/db/program-activity";

function validInput(body: Record<string, unknown>) {
  const divisionId = Number(body.divisionId);
  const title = String(body.title ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const pic = String(body.pic ?? "").trim();
  const startDate = String(body.startDate ?? "").trim();
  const endDate = String(body.endDate ?? "").trim();
  const target = String(body.target ?? "").trim();
  const budget = Math.max(0, Math.round(Number(body.budget) || 0));
  const status = String(body.status ?? "draft");
  return { divisionId, title, summary, pic, startDate, endDate, target, budget, status };
}

export async function GET() {
  try {
    await requireRegisteredUser();
    return Response.json({ programs: await listPrograms() });
  } catch (reason) {
    return accessErrorResponse(reason, "Daftar program kerja belum dapat dimuat.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRegisteredUser();
    const input = validInput(await request.json());
    if (!input.title || !Number.isInteger(input.divisionId) || input.divisionId < 1) {
      return Response.json({ error: "Nama program dan divisi wajib diisi." }, { status: 400 });
    }
    if (input.startDate && input.endDate && input.endDate < input.startDate) {
      return Response.json({ error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." }, { status: 400 });
    }
    if (!(await divisionExists(input.divisionId))) {
      return Response.json({ error: "Divisi tidak ditemukan atau sudah tidak aktif." }, { status: 400 });
    }
    assertCanManageDivision(user, input.divisionId);
    const program = await createProgram({
      ...input,
      status: "draft",
    });
    if (program) await logProgramActivity(user.id, program.id, "program_created", `Membuat program ${program.programCode} · ${program.title}.`);
    return Response.json({ program }, { status: 201 });
  } catch (reason) {
    return accessErrorResponse(reason, "Program kerja belum dapat ditambahkan.");
  }
}
