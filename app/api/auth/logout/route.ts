import {
  VPS_SESSION_COOKIE,
  clearSessionCookieHeader,
  getAppOrigin,
  getRequestCookie,
  revokeVpsSession,
  safeReturnPath,
} from "@/lib/vps-auth";

async function logout(request: Request) {
  const returnTo = safeReturnPath(
    new URL(request.url).searchParams.get("return_to"),
    "/",
  );
  const token = getRequestCookie(request, VPS_SESSION_COOKIE);
  await revokeVpsSession(token).catch(() => undefined);

  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(returnTo, getAppOrigin()).toString(),
      "Set-Cookie": clearSessionCookieHeader(),
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  return logout(request);
}

export async function POST(request: Request) {
  return logout(request);
}
