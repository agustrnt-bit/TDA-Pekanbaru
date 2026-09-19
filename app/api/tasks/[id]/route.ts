import { canonicalPicName, deleteTask, updateTask } from "@/db/tasks";

const priorities = ["Tinggi", "Sedang", "Rendah"];
const statuses = ["Belum Mulai", "Proses", "Selesai", "Tertunda"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    const body = await request.json();
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "ID tidak valid." }, { status: 400 });
    if (body.priority !== undefined && !priorities.includes(body.priority)) return Response.json({ error: "Prioritas tidak valid." }, { status: 400 });
    if (body.status !== undefined && !statuses.includes(body.status)) return Response.json({ error: "Status tidak valid." }, { status: 400 });
    if (body.categoryId !== undefined) body.categoryId = Number(body.categoryId);
    if (body.pic !== undefined) {
      const pic = await canonicalPicName(String(body.pic));
      if (pic === null) return Response.json({ error: "Pilih PIC dari daftar atau daftarkan nama PIC baru terlebih dahulu." }, { status: 400 });
      body.pic = pic;
    }
    const actor = String(body.actor ?? "Panitia").trim() || "Panitia";
    delete body.actor;
    const task = await updateTask(id, body, actor);
    if (!task) return Response.json({ error: "Pekerjaan tidak ditemukan." }, { status: 404 });
    return Response.json({ task });
  } catch {
    return Response.json({ error: "Perubahan belum dapat disimpan." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "ID tidak valid." }, { status: 400 });

    let actor = "Panitia";
    try {
      const body = await request.json();
      actor = String(body.actor ?? "Panitia").trim() || "Panitia";
    } catch {
      // Body opsional; nama default tetap digunakan.
    }

    const deleted = await deleteTask(id, actor);
    if (!deleted) return Response.json({ error: "Pekerjaan tidak ditemukan." }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Pekerjaan belum dapat dihapus." }, { status: 500 });
  }
}
