import type { CrewMeta, TaskKind } from "@fm-web/shared";

const STRING_FIELD_KEYS = [
  "window",
  "worktree",
  "project",
  "harness",
  "mode",
  "yolo",
  "tasktmp",
  "model",
  "effort",
  "backend",
  "terminal",
  "orca_worktree_id",
  "pr",
  "pr_head",
  "x_request",
  "x_request_ts",
  "x_followups",
] as const;

const KNOWN_KEYS: readonly string[] = [...STRING_FIELD_KEYS, "kind"];

function isKnownKey(key: string): boolean {
  return KNOWN_KEYS.includes(key);
}

const TASK_KINDS: readonly TaskKind[] = ["ship", "scout", "secondmate"];

function isTaskKind(value: string): value is TaskKind {
  return (TASK_KINDS as readonly string[]).includes(value);
}

/**
 * Parse `state/<id>.meta` (key=value per line). Last occurrence of a key wins,
 * mirroring `meta_value()`'s `tail -1` in `fm-crew-state.sh` (append-style updates are safe).
 */
export function parseMeta(content: string): CrewMeta {
  const values = new Map<string, string>();
  for (const line of content.split("\n")) {
    if (line.trim() === "") continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1);
    if (key === "") continue;
    values.set(key, value);
  }

  const extra: Record<string, string> = {};
  for (const [key, value] of values) {
    if (!isKnownKey(key)) extra[key] = value;
  }

  const rawKind = values.get("kind");
  const kind: TaskKind = rawKind !== undefined && isTaskKind(rawKind) ? rawKind : "ship";

  const meta: CrewMeta = { kind, extra };
  for (const key of STRING_FIELD_KEYS) {
    const value = values.get(key);
    if (value !== undefined) meta[key] = value;
  }
  return meta;
}
