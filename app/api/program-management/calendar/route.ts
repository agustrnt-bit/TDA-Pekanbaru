import { accessErrorResponse, requireRegisteredUser } from "@/db/access-control";
import { listCalendarEvents } from "@/db/program-management";

export async function GET(request: Request) {
  try {
    await requireRegisteredUser();
    const month = new URL(request.url).searchParams.get("month") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return Response.json({ error: "Bulan kalender tidak valid." }, { status: 400 });
    }
    const [year, monthNumber] = month.split("-").map(Number);
    const startDate = `${month}-01`;
    const endDate = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    return Response.json({ events: await listCalendarEvents(startDate, endDate) });
  } catch (reason) {
    return accessErrorResponse(reason, "Agenda program belum dapat dimuat.");
  }
}
