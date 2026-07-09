import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { LockInfo } from "@fm-web/shared";
import { lockPath } from "./paths.js";

const HARNESS_RE = /claude|codex|opencode|grok|^pi$/;
export const UNKNOWN_LOCK_PID = -1;

function isMissingPathError(error: unknown): boolean {
  if (error === null || typeof error !== "object" || !("code" in error)) return false;
  const code = error.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

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

/** Reads `state/.lock` (if present) and resolves liveness — the one place both the fleet snapshot and the command deck's read-only check should read the lock from. */
export function readLockInfo(fmHome: string): LockInfo {
  let content: string;
  try {
    content = readFileSync(lockPath(fmHome), "utf8");
  } catch (error) {
    if (isMissingPathError(error)) return { pid: null, alive: null };
    return { pid: UNKNOWN_LOCK_PID, alive: true };
  }
  const parsed = parseLock(content);
  return parsed.pid === null ? parsed : { pid: parsed.pid, alive: isHarnessPidAlive(parsed.pid) };
}
