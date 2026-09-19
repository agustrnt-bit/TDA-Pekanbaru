import { getCurrentAccess } from "@/db/access-control";
import { getUnreadNotificationCount } from "@/db/program-activity";
import { getProgramDashboard } from "@/db/program-management";

export async function GET() {
  try {
    const access = await getCurrentAccess();
    if (!access.user) return Response.json({ access, dashboard: null, unreadCount: 0 });
    const [dashboard, unreadCount] = await Promise.all([
      getProgramDashboard(),
      getUnreadNotificationCount(access.user.id),
    ]);
    return Response.json({ access, dashboard, unreadCount });
  } catch {
    return Response.json({ error: "Aplikasi belum dapat dimuat." }, { status: 500 });
  }
}
