import {
  VpsAuthError,
  changeVpsPassword,
  createVpsSession,
  getAppOrigin,
  getVpsSessionIdentity,
  isSameOriginRequest,
  safeReturnPath,
  sessionCookieHeader,
} from "@/lib/vps-auth";

function redirectToPassword(returnTo: string, error: string) {
  const target = new URL("/account/password", getAppOrigin());
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
      return redirectToPassword(returnTo, "origin");
    }

    const identity = await getVpsSessionIdentity();
    if (!identity) {
      const target = new URL("/login", getAppOrigin());
      target.searchParams.set("return_to", returnTo);
      return new Response(null, {
        status: 303,
        headers: { Location: target.toString(), "Cache-Control": "no-store" },
      });
    }

    const form = await request.formData();
    returnTo = safeReturnPath(String(form.get("return_to") || "/admin"));
    const currentPassword = String(form.get("current_password") || "");
    const newPassword = String(form.get("new_password") || "");
    const confirmPassword = String(form.get("confirm_password") || "");

    if (newPassword !== confirmPassword) {
      return redirectToPassword(returnTo, "mismatch");
    }

    await changeVpsPassword(identity.email, currentPassword, newPassword);
    const nextSession = await createVpsSession(identity.email);
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL(returnTo, getAppOrigin()).toString(),
        "Set-Cookie": sessionCookieHeader(
          nextSession.token,
          nextSession.expiresAt,
        ),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof VpsAuthError) {
      return redirectToPassword(returnTo, error.code);
    }
    return redirectToPassword(returnTo, "config");
  }
}
