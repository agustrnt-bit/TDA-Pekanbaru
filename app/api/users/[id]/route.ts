import { accessErrorResponse, requireKetua } from "@/db/access-control";
import { USER_ROLES, deactivateUser, getUser, updateUser } from "@/db/user-management";
import { divisionExists } from "@/db/program-management";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "viewer");
  const rawDivisionId = Number(body.divisionId);
  const divisionId = Number.isInteger(rawDivisionId) && rawDivisionId > 0 ? rawDivisionId : null;
  const isActive = body.isActive !== false;
  return { name, email, role, divisionId, isActive };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireKetua();
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID pengurus tidak valid." }, { status: 400 });
    const input = parseInput(await request.json());
    if (!input.name || !input.email || !/^\S+@\S+\.\S+$/.test(input.email)) {
      return Response.json({ error: "Nama dan email aktif wajib diisi." }, { status: 400 });
    }
    if (!USER_ROLES.includes(input.role as typeof USER_ROLES[number])) {
      return Response.json({ error: "Role pengguna tidak valid." }, { status: 400 });
    }
    if (input.role === "kadiv" && !input.divisionId) {
      return Response.json({ error: "Divisi wajib dipilih untuk role Kadiv." }, { status: 400 });
    }
    if (input.divisionId && !(await divisionExists(input.divisionId))) {
      return Response.json({ error: "Divisi tidak ditemukan atau sudah tidak aktif." }, { status: 400 });
    }
    if (id === actor.id && (input.role !== "ketua_ksb" || !input.isActive)) {
      return Response.json({ error: "Akses Ketua/KSB milik akun yang sedang digunakan tidak dapat dinonaktifkan." }, { status: 400 });
    }
    const user = await updateUser(id, {
      ...input,
      role: input.role as typeof USER_ROLES[number],
      divisionId: input.role === "kadiv" ? input.divisionId : null,
    });
    if (!user) return Response.json({ error: "Pengurus tidak ditemukan." }, { status: 404 });
    return Response.json({ user });
  } catch (reason) {
    if (reason instanceof Error && /UNIQUE constraint failed/i.test(reason.message)) {
      return Response.json({ error: "Email tersebut sudah terdaftar." }, { status: 409 });
    }
    return accessErrorResponse(reason, "Perubahan pengurus belum dapat disimpan.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireKetua();
    const id = parseId((await context.params).id);
    if (!id) return Response.json({ error: "ID pengurus tidak valid." }, { status: 400 });
    if (id === actor.id) return Response.json({ error: "Akun yang sedang digunakan tidak dapat dinonaktifkan." }, { status: 400 });
    if (!(await getUser(id))) return Response.json({ error: "Pengurus tidak ditemukan." }, { status: 404 });
    await deactivateUser(id);
    return Response.json({ ok: true });
  } catch (reason) {
    return accessErrorResponse(reason, "Pengurus belum dapat dinonaktifkan.");
  }
}
