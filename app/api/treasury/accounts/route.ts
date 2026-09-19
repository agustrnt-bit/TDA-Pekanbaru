import { accessErrorResponse, requireRegisteredUser } from "@/db/access-control";
import { listTreasuryAccounts } from "@/db/treasury";

export async function GET() {
  try {
    await requireRegisteredUser();
    return Response.json({ accounts: await listTreasuryAccounts() });
  } catch (reason) {
    return accessErrorResponse(reason, "Daftar rekening belum dapat dimuat.");
  }
}
