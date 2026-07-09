import type { PrStatus, StatusEntry, TaskDetail } from "@fm-web/shared";
import { briefPath, checkScriptPath, isSafeTaskId, metaPath, reportPath, statusPath } from "./paths.js";
import { parseMeta } from "./meta.js";
import { parseStatusLog } from "./status.js";
import { readCrewState, readIfExists, isExistingDirectory } from "./fleetState.js";
import { readNoMistakesGateStatus } from "../safety/scriptRunner.js";

/** `fm-pr-check.sh` writes `state/<id>.check.sh` as `gh pr view "<url>" --json state ...`. */
const CHECK_SCRIPT_URL_RE = /gh pr view "([^"]+)"/;

function buildPrStatus(
  fmHome: string,
  id: string,
  pr: string | undefined,
  prHead: string | undefined,
): PrStatus {
  const checkScript = readIfExists(checkScriptPath(fmHome, id));
  const pollTargetUrl = checkScript === null ? null : (CHECK_SCRIPT_URL_RE.exec(checkScript)?.[1] ?? null);
  return {
    url: pr ?? null,
    headSha: prHead ?? null,
    pollArmed: checkScript !== null,
    pollTargetUrl,
  };
}

/**
 * Build the full read-only detail for one task. `statusHistory` is the ENTIRE append-only
 * `.status` log — history/wake-events only, never current-state truth (that's `crewState`,
 * read via `fm-crew-state.sh`, same as the fleet snapshot). Returns null when the task has no
 * `state/<id>.meta` (unknown task id).
 */
export async function buildTaskDetail(fmHome: string, id: string): Promise<TaskDetail | null> {
  if (!isSafeTaskId(id)) return null;

  const metaContent = readIfExists(metaPath(fmHome, id));
  if (metaContent === null) return null;
  const meta = parseMeta(metaContent);

  const statusContent = readIfExists(statusPath(fmHome, id));
  const statusHistory: StatusEntry[] = statusContent === null ? [] : parseStatusLog(statusContent);

  const crewState = await readCrewState(fmHome, id);
  const brief = readIfExists(briefPath(fmHome, id));
  const report = readIfExists(reportPath(fmHome, id));
  const pr = buildPrStatus(fmHome, id, meta.pr, meta.pr_head);

  const worktreePresent = meta.worktree !== undefined && isExistingDirectory(meta.worktree);
  const gateStatusRaw =
    meta.kind === "ship" && worktreePresent && meta.worktree !== undefined
      ? await readNoMistakesGateStatus(meta.worktree)
      : null;

  return { id, meta, crewState, statusHistory, brief, report, pr, gateStatusRaw };
}
