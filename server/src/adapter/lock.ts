import type { LockInfo } from "@fm-web/shared";

/** Parse `state/.lock` — a bare harness PID, one line, no other fields. */
export function parseLock(content: string): LockInfo {
  const pid = Number(content.trim());
  return { pid: Number.isInteger(pid) && pid > 0 ? pid : null };
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
