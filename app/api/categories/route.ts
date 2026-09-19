import { createCategory, ensureSeedData, listCategories } from "@/db/tasks";

export async function GET() {
  try {
    await ensureSeedData();
    return Response.json({ categories: await listCategories() });
  } catch {
    return Response.json({ error: "Kategori belum dapat dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim().toUpperCase();
    if (!name) return Response.json({ error: "Nama kategori wajib diisi." }, { status: 400 });
    const category = await createCategory(name, String(body.actor ?? "Panitia").trim() || "Panitia");
    return Response.json({ category }, { status: 201 });
  } catch {
    return Response.json({ error: "Kategori sudah ada atau belum dapat ditambahkan." }, { status: 400 });
  }
}
