import { accessErrorResponse, requireTreasuryManager } from "@/db/access-control";
import { createTreasuryCategory, listTreasuryCategories } from "@/db/treasury";

export async function GET() {
  try {
    await requireTreasuryManager();
    return Response.json({ categories: await listTreasuryCategories() });
  } catch (reason) {
    return accessErrorResponse(reason, "Kategori belum dapat dimuat.");
  }
}

export async function POST(request: Request) {
  try {
    await requireTreasuryManager();
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 80) {
      return Response.json({ error: "Nama kategori harus terdiri dari 2–80 karakter." }, { status: 400 });
    }
    return Response.json({ category: await createTreasuryCategory(name) }, { status: 201 });
  } catch (reason) {
    if (reason instanceof Error && reason.message === "CATEGORY_EXISTS") {
      return Response.json({ error: "Kategori tersebut sudah tersedia." }, { status: 409 });
    }
    return accessErrorResponse(reason, "Kategori belum dapat ditambahkan.");
  }
}
