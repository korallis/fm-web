import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import type {
  Backlog,
  BacklogTask,
  FleetSnapshot,
  FleetTask,
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
import { parseLock } from "./lock.js";
import { beaconAgeSeconds, isBeaconFresh } from "./beacon.js";
import { isCaptainRelevant } from "./captainClassifier.js";
import { DEFAULT_TIMING } from "./timing.js";

function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** Task ids are recovered from `state/*.meta` filenames — the id-to-file mapping is a firstmate convention. */
function listTaskIds(fmHome: string): string[] {
  const dir = stateDir(fmHome);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".meta"))
    .map((name) => name.slice(0, -".meta".length));
}

function findBacklogRef(id: string, backlog: Backlog): BacklogTask | null {
  return backlog.inFlight.find((t) => t.id === id) ?? backlog.queued.find((t) => t.id === id) ?? null;
}

function buildSupervisionHealth(fmHome: string, timing: TimingConstants, nowMs: number): SupervisionHealth {
  const lockContent = readIfExists(lockPath(fmHome));
  const lock = lockContent === null ? { pid: null } : parseLock(lockContent);

  const beacon = beaconPath(fmHome);
  let beaconLastBeatMs: number | null = null;
  if (existsSync(beacon)) beaconLastBeatMs = statSync(beacon).mtimeMs;
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
): FleetSnapshot {
  const backlogContent = readIfExists(backlogPath(fmHome));
  const backlog: Backlog =
    backlogContent === null ? { inFlight: [], queued: [], done: [] } : parseBacklog(backlogContent);

  const projectsContent = readIfExists(projectsPath(fmHome));
  const projects = projectsContent === null ? [] : parseProjects(projectsContent);

  const secondmatesContent = readIfExists(secondmatesPath(fmHome));
  const secondmates = secondmatesContent === null ? [] : parseSecondmates(secondmatesContent);

  const tasks: FleetTask[] = listTaskIds(fmHome).map((id) => {
    const meta = parseMeta(readFileSync(metaPath(fmHome, id), "utf8"));
    const statusContent = readIfExists(statusPath(fmHome, id));
    const status = statusContent === null ? null : latestStatus(parseStatusLog(statusContent));
    return {
      id,
      meta,
      latestStatus: status,
      captainRelevant: status !== null && isCaptainRelevant(status.raw),
      backlogRef: findBacklogRef(id, backlog),
      worktreePresent: meta.worktree !== undefined && existsSync(meta.worktree),
    };
  });

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
