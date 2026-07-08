export const DEFAULT_SERVER_PORT = 4870;

export function loadPortFromEnv(env: Record<string, string | undefined>): number {
  const raw = env["PORT"];
  if (raw === undefined) return DEFAULT_SERVER_PORT;
  const trimmed = raw.trim();
  if (trimmed === "") return DEFAULT_SERVER_PORT;
  const port = Number(trimmed);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_SERVER_PORT;
}
