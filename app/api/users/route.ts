import { accessErrorResponse, requireKetua } from "@/db/access-control";
import { USER_ROLES, createUser, listUsers } from "@/db/user-management";
import { divisionExists } from "@/db/program-management";

function parseInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "viewer");
  const rawDivisionId = Number(body.divisionId);
  const divisionId = Number.isInteger(rawDivisionId) && rawDivisionId > 0 ? rawDivisionId : null;
  const isActive = body.isActive !== false;
  return { name, email, role, divisionId, isActive };
}

async function validate(input: ReturnType<typeof parseInput>) {
  if (!input.name || !input.email || !/^\S+@\S+\.\S+$/.test(input.email)) return "Nama dan email aktif wajib diisi.";
  if (!USER_ROLES.includes(input.role as typeof USER_ROLES[number])) return "Role pengguna tidak valid.";
  if (input.role === "kadiv" && !input.divisionId) return "Divisi wajib dipilih untuk role Kadiv.";
  if (input.divisionId && !(await divisionExists(input.divisionId))) return "Divisi tidak ditemukan atau sudah tidak aktif.";
  return null;
}

export async function GET() {
  try {
    await requireKetua();
    return Response.json({ users: await listUsers() });
  } catch (reason) {
    return accessErrorResponse(reason, "Master Pengurus belum dapat dimuat.");
  }
}

export async function POST(request: Request) {
  try {
    await requireKetua();
    const input = parseInput(await request.json());
    const validationError = await validate(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const user = await createUser({
      ...input,
      role: input.role as typeof USER_ROLES[number],
      divisionId: input.role === "kadiv" ? input.divisionId : null,
    });
    return Response.json({ user }, { status: 201 });
  } catch (reason) {
    if (reason instanceof Error && /UNIQUE constraint failed/i.test(reason.message)) {
      return Response.json({ error: "Email tersebut sudah terdaftar." }, { status: 409 });
    }
    return accessErrorResponse(reason, "Pengurus belum dapat ditambahkan.");
  }
}
