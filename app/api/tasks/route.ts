import { canonicalPicName, createTask, ensureSeedData, listCategories, listPics, listTasks } from "@/db/tasks";

const priorities = ["Tinggi", "Sedang", "Rendah"];
const statuses = ["Belum Mulai", "Proses", "Selesai", "Tertunda"];

export async function GET() {
  try {
    await ensureSeedData();
    const [tasks, categories, pics] = await Promise.all([listTasks(), listCategories(), listPics()]);
    return Response.json({ tasks, categories, pics });
  } catch {
    return Response.json({ error: "Checklist belum dapat dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title?.trim() || !body.dueDate || !Number.isInteger(Number(body.categoryId))) {
      return Response.json({ error: "Pekerjaan, kategori, dan due date wajib diisi." }, { status: 400 });
    }
    const pic = await canonicalPicName(String(body.pic ?? ""));
    if (pic === null) return Response.json({ error: "Pilih PIC dari daftar atau daftarkan nama PIC baru terlebih dahulu." }, { status: 400 });
    const task = await createTask({
      categoryId: Number(body.categoryId), title: body.title.trim(), pic,
      dueDate: body.dueDate, priority: priorities.includes(body.priority) ? body.priority : "Sedang",
      status: statuses.includes(body.status) ? body.status : "Belum Mulai", notes: String(body.notes ?? "").trim(),
    }, String(body.actor ?? "Panitia").trim() || "Panitia");
    return Response.json({ task }, { status: 201 });
  } catch {
    return Response.json({ error: "Pekerjaan belum dapat ditambahkan." }, { status: 500 });
  }
}
