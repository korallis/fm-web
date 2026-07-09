import type { GuardedActionResult } from "@fm-web/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function stringError(body: unknown, fallback: string): string {
  return isRecord(body) && typeof body["error"] === "string" ? body["error"] : fallback;
}

export function normalizeGuardedActionResult(body: unknown, fallbackError: string): GuardedActionResult {
  if (
    isRecord(body) &&
    typeof body["ok"] === "boolean" &&
    (body["exitCode"] === null || typeof body["exitCode"] === "number") &&
    typeof body["stdout"] === "string" &&
    typeof body["stderr"] === "string" &&
    (body["error"] === undefined || typeof body["error"] === "string")
  ) {
    return {
      ok: body["ok"],
      exitCode: body["exitCode"],
      stdout: body["stdout"],
      stderr: body["stderr"],
      ...(body["error"] === undefined ? {} : { error: body["error"] }),
    };
  }

  return {
    ok: false,
    exitCode: null,
    stdout: "",
    stderr: "",
    error: stringError(body, fallbackError),
  };
}

export async function readGuardedActionResponse(res: Response, label: string): Promise<GuardedActionResult> {
  const body = await res.json().catch(() => null);
  return normalizeGuardedActionResult(body, `${label} failed: ${res.status}`);
}
