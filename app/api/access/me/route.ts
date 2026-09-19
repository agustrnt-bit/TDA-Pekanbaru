import { getCurrentAccess } from "@/db/access-control";

export async function GET() {
  try {
    return Response.json({ access: await getCurrentAccess() });
  } catch {
    return Response.json({ error: "Informasi akses belum dapat dimuat." }, { status: 500 });
  }
}
