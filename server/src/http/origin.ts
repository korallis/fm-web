export function isSameOriginRequest(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (origin === null) return true;

  const host = headers.get("host");
  if (host === null || host.trim() === "") return false;

  try {
    if (new URL(origin).host === host) return true;
  } catch {
    return false;
  }

  return headers.get("sec-fetch-site") === "same-origin";
}

export function crossOriginResponse(): Response {
  return Response.json({ error: "cross-origin requests are not allowed" }, { status: 403 });
}
