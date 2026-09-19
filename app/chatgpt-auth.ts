import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";
const IS_VPS_RUNTIME = process.env.TDA_RUNTIME === "vps";

function toChatGPTUser(identity: { email: string; displayName: string }): ChatGPTUser {
  return {
    displayName: identity.displayName || identity.email,
    email: identity.email,
    fullName: identity.displayName || null,
  };
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if (IS_VPS_RUNTIME) {
    const { getVpsSessionIdentity } = await import("@/lib/vps-auth");
    const identity = await getVpsSessionIdentity();
    if (!identity || identity.mustChangePassword) return null;
    return toChatGPTUser(identity);
  }

  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  if (IS_VPS_RUNTIME) {
    const { getVpsSessionIdentity, safeReturnPath } = await import(
      "@/lib/vps-auth"
    );
    const identity = await getVpsSessionIdentity();
    if (identity?.mustChangePassword) {
      const safeReturnTo = safeReturnPath(returnTo);
      redirect(`/account/password?return_to=${encodeURIComponent(safeReturnTo)}`);
    }
    if (identity) return toChatGPTUser(identity);
    redirect(chatGPTSignInPath(returnTo));
  }

  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (IS_VPS_RUNTIME) {
    return `/login?return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (IS_VPS_RUNTIME) {
    return `/api/auth/logout?return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH ||
    pathname === "/login" ||
    pathname === "/account/password" ||
    pathname.startsWith("/api/auth/")
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
