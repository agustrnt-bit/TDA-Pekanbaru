import {
  VpsAuthError,
  authenticateVpsAccount,
  createVpsSession,
  getAppOrigin,
  isSameOriginRequest,
  safeReturnPath,
  sessionCookieHeader,
} from "@/lib/vps-auth";

function redirectToLogin(returnTo: string, error: string) {
  const target = new URL("/login", getAppOrigin());
  target.searchParams.set("return_to", returnTo);
  target.searchParams.set("error", error);
  return new Response(null, {
    status: 303,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  if (process.env.TDA_RUNTIME !== "vps") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let returnTo = "/admin";
  try {
    if (!isSameOriginRequest(request)) {
      return redirectToLogin(returnTo, "origin");
    }

    const form = await request.formData();
    returnTo = safeReturnPath(String(form.get("return_to") || "/admin"));
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    const identity = await authenticateVpsAccount(request, email, password);
    const session = await createVpsSession(identity.email);
    const destination = identity.mustChangePassword
      ? `/account/password?return_to=${encodeURIComponent(returnTo)}`
      : returnTo;

    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL(destination, getAppOrigin()).toString(),
        "Set-Cookie": sessionCookieHeader(session.token, session.expiresAt),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof VpsAuthError) {
      return redirectToLogin(returnTo, error.code);
    }
    return redirectToLogin(returnTo, "config");
  }
}
