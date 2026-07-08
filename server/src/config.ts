export { DEFAULT_SERVER_PORT, loadPortFromEnv, parsePortValue } from "@fm-web/shared";

const DEFAULT_HARNESS_COMMAND = "claude";

/** The command run inside the app-owned first-mate session (a normal terminal command, e.g. `claude`). */
export function loadHarnessCommandFromEnv(env: Record<string, string | undefined>): string {
  const value = env["FM_DECK_HARNESS_CMD"]?.trim();
  return value === undefined || value === "" ? DEFAULT_HARNESS_COMMAND : value;
}
