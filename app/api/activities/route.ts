import { listActivities } from "@/db/tasks";

export async function GET() {
  try {
    return Response.json({ activities: await listActivities() });
  } catch {
    return Response.json({ error: "Riwayat aktivitas belum dapat dimuat." }, { status: 500 });
  }
}
