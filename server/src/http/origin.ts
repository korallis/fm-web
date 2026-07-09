export function isSameOriginRequest(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (origin === null) return true;

  const host = headers.get("host");
  if (host === null || host.trim() === "") return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function crossOriginResponse(): Response {
  return Response.json({ error: "cross-origin requests are not allowed" }, { status: 403 });
}
