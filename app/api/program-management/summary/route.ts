import { accessErrorResponse, requireRegisteredUser } from "@/db/access-control";
import { getProgramDashboard } from "@/db/program-management";

export async function GET() {
  try {
    await requireRegisteredUser();
    return Response.json(await getProgramDashboard());
  } catch (reason) {
    return accessErrorResponse(reason, "Ringkasan program kerja belum dapat dimuat.");
  }
}
