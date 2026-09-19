import { createPic, ensureSeedData, listPics } from "@/db/tasks";

export async function GET() {
  try {
    await ensureSeedData();
    return Response.json({ pics: await listPics() });
  } catch {
    return Response.json({ error: "Daftar PIC belum dapat dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) {
      return Response.json({ error: "Nama PIC harus terdiri dari 2–80 karakter." }, { status: 400 });
    }
    const result = await createPic(name, String(body.actor ?? "Panitia").trim() || "Panitia");
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch {
    return Response.json({ error: "PIC belum dapat didaftarkan." }, { status: 500 });
  }
}
