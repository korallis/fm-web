import { existsSync, readdirSync, readFileSync, statSync, type Stats } from "node:fs";
import type {
  Backlog,
  BacklogTask,
  FleetSnapshot,
  FleetTask,
  LockInfo,
  SupervisionHealth,
  TimingConstants,
} from "@fm-web/shared";
import {
  afkPath,
  backlogPath,
  beaconPath,
  lockPath,
  metaPath,
  projectsPath,
  secondmatesPath,
  statusPath,
  stateDir,
} from "./paths.js";
import { parseMeta } from "./meta.js";
import { latestStatus, parseStatusLog } from "./status.js";
import { parseBacklog } from "./backlog.js";
import { parseProjects } from "./projects.js";
import { parseSecondmates } from "./secondmates.js";
import { isHarnessPidAlive, parseLock } from "./lock.js";
import { beaconAgeSeconds, isBeaconFresh } from "./beacon.js";
import { FM_CAPTAIN_RE_DEFAULT, isCaptainRelevant } from "./captainClassifier.js";
import { DEFAULT_TIMING } from "./timing.js";

function isMissingPathError(error: unknown): boolean {
  if (error === null || typeof error !== "object" || !("code" in error)) return false;
  const code = error.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function readIfExists(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw error;
  }
}

function statIfExists(path: string): Stats | null {
  try {
    return statSync(path);
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw error;
  }
}

/** Task ids are recovered from `state/*.meta` filenames — the id-to-file mapping is a firstmate convention. */
function listTaskIds(fmHome: string): string[] {
  try {
    return readdirSync(stateDir(fmHome))
      .filter((name) => name.endsWith(".meta"))
      .map((name) => name.slice(0, -".meta".length));
  } catch (error) {
    if (isMissingPathError(error)) return [];
    throw error;
  }
}

function findBacklogRef(id: string, backlog: Backlog): BacklogTask | null {
  return backlog.inFlight.find((t) => t.id === id) ?? backlog.queued.find((t) => t.id === id) ?? null;
}

function buildSupervisionHealth(fmHome: string, timing: TimingConstants, nowMs: number): SupervisionHealth {
  const lockContent = readIfExists(lockPath(fmHome));
  const parsedLock: LockInfo = lockContent === null ? { pid: null, alive: null } : parseLock(lockContent);
  const lock: LockInfo =
    parsedLock.pid === null ? parsedLock : { pid: parsedLock.pid, alive: isHarnessPidAlive(parsedLock.pid) };

  const beaconStat = statIfExists(beaconPath(fmHome));
  const beaconLastBeatMs = beaconStat?.mtimeMs ?? null;
  const ageSeconds = beaconLastBeatMs === null ? null : beaconAgeSeconds(beaconLastBeatMs, nowMs);

  return {
    lock,
    beaconLastBeatMs,
    beaconAgeSeconds: ageSeconds,
    beaconFresh: ageSeconds !== null && isBeaconFresh(ageSeconds, timing.guardGraceSeconds),
    afk: existsSync(afkPath(fmHome)),
    timing,
  };
}

/** Build a full read-only fleet snapshot from a firstmate home. Never writes anything. */
export function buildFleetSnapshot(
  fmHome: string,
  nowMs: number = Date.now(),
  timing: TimingConstants = DEFAULT_TIMING,
  captainRegex: RegExp = FM_CAPTAIN_RE_DEFAULT,
): FleetSnapshot {
  const backlogContent = readIfExists(backlogPath(fmHome));
  const backlog: Backlog =
    backlogContent === null ? { inFlight: [], queued: [], done: [] } : parseBacklog(backlogContent);

  const projectsContent = readIfExists(projectsPath(fmHome));
  const projects = projectsContent === null ? [] : parseProjects(projectsContent);

  const secondmatesContent = readIfExists(secondmatesPath(fmHome));
  const secondmates = secondmatesContent === null ? [] : parseSecondmates(secondmatesContent);

  const tasks: FleetTask[] = [];
  for (const id of listTaskIds(fmHome)) {
    const metaContent = readIfExists(metaPath(fmHome, id));
    if (metaContent === null) continue;
    const meta = parseMeta(metaContent);
    const statusContent = readIfExists(statusPath(fmHome, id));
    const status = statusContent === null ? null : latestStatus(parseStatusLog(statusContent));
    tasks.push({
      id,
      meta,
      latestStatus: status,
      captainRelevant: status !== null && isCaptainRelevant(status.raw, captainRegex),
      backlogRef: findBacklogRef(id, backlog),
      worktreePresent: meta.worktree !== undefined && existsSync(meta.worktree),
    });
  }

  return {
    generatedAtMs: nowMs,
    fmHome,
    tasks,
    backlog,
    projects,
    secondmates,
    supervision: buildSupervisionHealth(fmHome, timing, nowMs),
  };
}
