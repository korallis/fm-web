import { existsSync, readdirSync, readFileSync, statSync, type Stats } from "node:fs";
import type {
  Backlog,
  BacklogTask,
  CrewStateOutput,
  FleetSnapshot,
  FleetTask,
  SupervisionHealth,
  TimingConstants,
} from "@fm-web/shared";
import {
  afkPath,
  backlogPath,
  beaconPath,
  metaPath,
  projectsPath,
  secondmatesPath,
  statusPath,
  stateDir,
  wakeQueuePath,
  watchTriagePath,
} from "./paths.js";
import { parseMeta } from "./meta.js";
import { latestStatus, parseStatusLog } from "./status.js";
import { parseBacklog } from "./backlog.js";
import { parseProjects } from "./projects.js";
import { parseSecondmates } from "./secondmates.js";
import { readLockInfo } from "./lock.js";
import { beaconAgeSeconds, isBeaconFresh } from "./beacon.js";
import { FM_CAPTAIN_RE_DEFAULT, isCaptainRelevant } from "./captainClassifier.js";
import { DEFAULT_TIMING } from "./timing.js";
import { parseCrewStateOutput } from "./crewState.js";
import { parseWakeQueue } from "./wakeQueue.js";
import { parseWatchTriageLog } from "./watchTriage.js";
import { buildDecisionsInbox } from "./decisions.js";
import { runReadOnlyScript } from "../safety/scriptRunner.js";

function isMissingPathError(error: unknown): boolean {
  if (error === null || typeof error !== "object" || !("code" in error)) return false;
  const code = error.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

export function readIfExists(path: string): string | null {
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

export function isExistingDirectory(path: string): boolean {
  return statIfExists(path)?.isDirectory() ?? false;
}

/** Task ids are recovered from `state/*.meta` filenames - the id-to-file mapping is a firstmate convention. */
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

export async function readCrewState(fmHome: string, id: string): Promise<CrewStateOutput> {
  try {
    const result = await runReadOnlyScript(fmHome, "fm-crew-state.sh", [id]);
    const stdoutLine = result.stdout.split(/\r?\n/).find((line) => line.trim() !== "");
    if (stdoutLine !== undefined) return parseCrewStateOutput(stdoutLine);
    const stderrLine = result.stderr.split(/\r?\n/).find((line) => line.trim() !== "");
    return {
      state: "unknown",
      source: "none",
      detail: stderrLine ?? `fm-crew-state.sh exited ${result.exitCode ?? "without a status"}`,
    };
  } catch {
    return { state: "unknown", source: "none", detail: "crew-state unavailable" };
  }
}

function buildSupervisionHealth(fmHome: string, timing: TimingConstants, nowMs: number): SupervisionHealth {
  const lock = readLockInfo(fmHome);

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
export async function buildFleetSnapshot(
  fmHome: string,
  nowMs: number = Date.now(),
  timing: TimingConstants = DEFAULT_TIMING,
  captainRegex: RegExp = FM_CAPTAIN_RE_DEFAULT,
): Promise<FleetSnapshot> {
  const backlogContent = readIfExists(backlogPath(fmHome));
  const backlog: Backlog =
    backlogContent === null ? { inFlight: [], queued: [], done: [] } : parseBacklog(backlogContent);

  const projectsContent = readIfExists(projectsPath(fmHome));
  const projects = projectsContent === null ? [] : parseProjects(projectsContent);

  const secondmatesContent = readIfExists(secondmatesPath(fmHome));
  const secondmates = secondmatesContent === null ? [] : parseSecondmates(secondmatesContent);

  const taskResults = await Promise.all(
    listTaskIds(fmHome).map(async (id): Promise<FleetTask | null> => {
      const metaContent = readIfExists(metaPath(fmHome, id));
      if (metaContent === null) return null;
      const meta = parseMeta(metaContent);
      const statusContent = readIfExists(statusPath(fmHome, id));
      const status = statusContent === null ? null : latestStatus(parseStatusLog(statusContent));
      const crewState = await readCrewState(fmHome, id);
      return {
        id,
        meta,
        crewState,
        latestStatus: status,
        captainRelevant:
          isCaptainRelevant(crewState.detail, captainRegex) ||
          (status !== null && isCaptainRelevant(status.raw, captainRegex)),
        backlogRef: findBacklogRef(id, backlog),
        worktreePresent: meta.worktree !== undefined && isExistingDirectory(meta.worktree),
      };
    }),
  );
  const tasks = taskResults.filter((task): task is FleetTask => task !== null);

  const wakeQueueContent = readIfExists(wakeQueuePath(fmHome));
  const wakeQueue = wakeQueueContent === null ? [] : parseWakeQueue(wakeQueueContent);

  const watchTriageContent = readIfExists(watchTriagePath(fmHome));
  const watchTriage = watchTriageContent === null ? [] : parseWatchTriageLog(watchTriageContent);

  return {
    generatedAtMs: nowMs,
    fmHome,
    tasks,
    backlog,
    projects,
    secondmates,
    supervision: buildSupervisionHealth(fmHome, timing, nowMs),
    decisions: buildDecisionsInbox(tasks),
    wakeQueue,
    watchTriage,
  };
}
