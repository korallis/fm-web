import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import type { LockInfo } from "@fm-web/shared";

const HARNESS_RE = /claude|codex|opencode|grok|^pi$/;

/** Parse `state/.lock` - a bare harness PID, one line, no other fields. */
export function parseLock(content: string): LockInfo {
  const pid = Number(content.trim());
  return { pid: Number.isInteger(pid) && pid > 0 ? pid : null, alive: null };
}

/** True if a process with this pid is alive (signal 0, no actual kill). */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function psValue(pid: number, field: "args" | "comm"): string | null {
  try {
    return execFileSync("ps", ["-o", `${field}=`, "-p", String(pid)], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export function isHarnessPidAlive(pid: number): boolean {
  if (!isPidAlive(pid)) return false;
  const comm = psValue(pid, "comm");
  if (comm === null) return false;
  const args = psValue(pid, "args") ?? "";
  return HARNESS_RE.test(basename(comm)) || HARNESS_RE.test(args);
}
