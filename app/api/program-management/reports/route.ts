import { accessErrorResponse, requireRegisteredUser } from "@/db/access-control";
import { getProgramReport } from "@/db/program-management";

export async function GET() {
  try {
    await requireRegisteredUser();
    return Response.json(await getProgramReport());
  } catch (reason) {
    console.error("Program report failed", reason);
    return accessErrorResponse(reason, "Laporan program kerja belum dapat dimuat.");
  }
}
