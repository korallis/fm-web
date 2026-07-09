import { join } from "node:path";

/** Path helpers for a firstmate home. All reads are relative to `fmHome`; never hardcode a home. */
export function isSafeTaskId(taskId: string): boolean {
  return (
    taskId.length > 0 && taskId !== "." && taskId !== ".." && !/[\\/]/.test(taskId) && !taskId.includes("\0")
  );
}

export function stateDir(fmHome: string): string {
  return join(fmHome, "state");
}

export function dataDir(fmHome: string): string {
  return join(fmHome, "data");
}

export function binDir(fmHome: string): string {
  return join(fmHome, "bin");
}

export function metaPath(fmHome: string, taskId: string): string {
  return join(stateDir(fmHome), `${taskId}.meta`);
}

export function statusPath(fmHome: string, taskId: string): string {
  return join(stateDir(fmHome), `${taskId}.status`);
}

/** `fm-pr-check.sh`'s merge-poll script — its mere existence means the watcher is polling for merge/close. */
export function checkScriptPath(fmHome: string, taskId: string): string {
  return join(stateDir(fmHome), `${taskId}.check.sh`);
}

export function wakeQueuePath(fmHome: string): string {
  return join(stateDir(fmHome), ".wake-queue");
}

export function lockPath(fmHome: string): string {
  return join(stateDir(fmHome), ".lock");
}

export function beaconPath(fmHome: string): string {
  return join(stateDir(fmHome), ".last-watcher-beat");
}

export function afkPath(fmHome: string): string {
  return join(stateDir(fmHome), ".afk");
}

export function watchTriagePath(fmHome: string): string {
  return join(stateDir(fmHome), ".watch-triage.log");
}

export function backlogPath(fmHome: string): string {
  return join(dataDir(fmHome), "backlog.md");
}

export function projectsPath(fmHome: string): string {
  return join(dataDir(fmHome), "projects.md");
}

export function secondmatesPath(fmHome: string): string {
  return join(dataDir(fmHome), "secondmates.md");
}

export function briefPath(fmHome: string, taskId: string): string {
  return join(dataDir(fmHome), taskId, "brief.md");
}

export function reportPath(fmHome: string, taskId: string): string {
  return join(dataDir(fmHome), taskId, "report.md");
}
