import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { capturePaneTail, hasSession, newSession, panePid } from "./tmuxClient.js";
import { isBusyFromTail } from "./composerState.js";

/**
 * The app-owned first-mate tmux session: one deterministically-named session per firstmate home,
 * auto-started on boot and reused (never recreated) across app restarts as long as tmux itself
 * stays up. This is a session THIS app owns and created - never a firstmate-tracked crewmate - so
 * controlling it (send-keys/capture-pane) sits entirely outside the safety module's script
 * allowlist.
 */

const SESSION_PREFIX = "fm-deck-";
const WINDOW_NAME = "main";
const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 50;
const BUSY_TAIL_LINES = 40;

export function sessionNameFor(fmHome: string): string {
  const hash = createHash("sha256").update(fmHome).digest("hex").slice(0, 12);
  return `${SESSION_PREFIX}${hash}`;
}

export function sessionTargetFor(fmHome: string): string {
  return `${sessionNameFor(fmHome)}:${WINDOW_NAME}`;
}

export async function isFirstMateSessionReady(fmHome: string): Promise<boolean> {
  return hasSession(sessionNameFor(fmHome));
}

export interface EnsureSessionResult {
  target: string;
  created: boolean;
}

/** Idempotent: reuses an already-running session (surviving an app restart); only spawns a new one otherwise. */
export async function ensureFirstMateSession(
  fmHome: string,
  harnessCommand: string,
): Promise<EnsureSessionResult> {
  const sessionName = sessionNameFor(fmHome);
  const target = `${sessionName}:${WINDOW_NAME}`;
  if (await hasSession(sessionName)) return { target, created: false };
  const result = await newSession({
    sessionName,
    windowName: WINDOW_NAME,
    cwd: fmHome,
    command: harnessCommand,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  if (result.code !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.code ?? "unknown"}`;
    throw new Error(`tmux new-session failed: ${detail}`);
  }
  return { target, created: true };
}

export async function isSessionBusy(target: string): Promise<boolean> {
  const tail = await capturePaneTail(target, BUSY_TAIL_LINES);
  if (tail === null) return false;
  return isBusyFromTail(tail);
}

function ppidOf(pid: number): number | null {
  try {
    const out = execFileSync("ps", ["-o", "ppid=", "-p", String(pid)], { encoding: "utf8" }).trim();
    const value = Number(out);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Walk up `pid`'s ancestry (bounded) to check whether `ancestorPid` is itself or among its ancestors. */
export function isPidDescendantOf(pid: number, ancestorPid: number, maxDepth = 12): boolean {
  let current: number | null = pid;
  for (let i = 0; i < maxDepth && current !== null; i++) {
    if (current === ancestorPid) return true;
    current = ppidOf(current);
  }
  return false;
}

/**
 * True when `lockPid` (from `state/.lock`) is owned by our own app-owned session's pane - i.e. it
 * is the harness process we ourselves spawned, not some other live firstmate session holding the
 * lock. Used to decide read-only/coexistence mode without ever acquiring the lock ourselves.
 */
export async function isLockHeldByOwnSession(target: string, lockPid: number): Promise<boolean> {
  const ownPanePid = await panePid(target);
  if (ownPanePid === null) return false;
  if (lockPid === ownPanePid) return true;
  return isPidDescendantOf(lockPid, ownPanePid);
}
