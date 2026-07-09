import type { GuardedActionResult } from "@fm-web/shared";
import { isSafeTaskId } from "../adapter/paths.js";
import { MUTATING_SCRIPTS } from "./allowlist.js";
import type { MutatingScript, ReadOnlyScript } from "./allowlist.js";
import { recordAudit } from "./audit.js";
import { runMutatingScript, runReadOnlyScript } from "./scriptRunner.js";
import type { ScriptResult } from "./scriptRunner.js";

export class GuardedActionError extends Error {}

/** Every one of these scripts' first positional argument is `<task-id>` per its own usage string. */
const TASK_ID_FIRST_ARG_SCRIPTS = new Set<string>([
  "fm-brief.sh",
  "fm-spawn.sh",
  "fm-send.sh",
  "fm-teardown.sh",
  "fm-pr-check.sh",
  "fm-pr-merge.sh",
  "fm-merge-local.sh",
  "fm-promote.sh",
  "fm-review-diff.sh",
]);

/** The read-only script the advanced drawer also exposes (alongside the mutating allowlist). */
export const ADVANCED_DRAWER_READONLY_SCRIPTS = [
  "fm-review-diff.sh",
] as const satisfies readonly ReadOnlyScript[];

export const ADVANCED_DRAWER_MUTATING_SCRIPTS = [
  "fm-spawn.sh",
  "fm-teardown.sh",
  "fm-pr-check.sh",
  "fm-pr-merge.sh",
  "fm-merge-local.sh",
  "fm-promote.sh",
  "fm-watch-arm.sh",
] as const satisfies readonly MutatingScript[];

export const ADVANCED_DRAWER_SCRIPTS = [
  ...ADVANCED_DRAWER_MUTATING_SCRIPTS,
  ...ADVANCED_DRAWER_READONLY_SCRIPTS,
] as const;

export function isAdvancedDrawerMutatingScript(script: string): script is MutatingScript {
  return (ADVANCED_DRAWER_MUTATING_SCRIPTS as readonly string[]).includes(script);
}

export function isAdvancedDrawerScript(script: string): boolean {
  return (ADVANCED_DRAWER_SCRIPTS as readonly string[]).includes(script);
}

/**
 * The one shape invariant every drawer/task-page caller must satisfy before a script ever spawns:
 * a valid task id where the script expects one. Per-script flag grammars (`--harness`, `--force`,
 * `--stat`, ...) are the client form's job to build correctly; scriptRunner's timeout/output-cap/
 * traversal guards are the safety net for anything else.
 */
export function validateGuardedArgs(script: MutatingScript | ReadOnlyScript, args: readonly string[]): void {
  if (!TASK_ID_FIRST_ARG_SCRIPTS.has(script)) return;
  const taskId = args[0];
  if (taskId === undefined || !isSafeTaskId(taskId)) {
    throw new GuardedActionError(`${script} requires a valid task id as its first argument`);
  }
}

/** Human-readable command preview for the drawer's confirm step (never sent to a shell). */
export function previewCommandLine(script: string, args: readonly string[]): string {
  return [script, ...args].join(" ");
}

function firstNonBlankLine(text: string): string | undefined {
  return text.split(/\r?\n/).find((line) => line.trim() !== "");
}

function summarize(result: { exitCode: number | null; stdout: string; stderr: string }): string {
  return (
    firstNonBlankLine(result.stdout) ??
    firstNonBlankLine(result.stderr) ??
    `exit ${result.exitCode ?? "unknown"}`
  );
}

export function recordGuardedActionDenial(
  script: string,
  args: readonly string[],
  error: string,
): GuardedActionResult {
  recordAudit({ script, args, ok: false, summary: error });
  return { ok: false, exitCode: null, stdout: "", stderr: "", error };
}

/**
 * The one entry point the advanced drawer and task-detail unstick ladder both call: validates the
 * task-id shape, dispatches to the read-only or mutating runner depending on which allowlist the
 * script is on, and always records an audit entry - including on rejection, so refused attempts
 * show up in the trail too.
 */
export async function runGuardedAction(
  fmHome: string,
  script: string,
  args: readonly string[],
): Promise<GuardedActionResult> {
  try {
    let result: ScriptResult;
    if ((ADVANCED_DRAWER_READONLY_SCRIPTS as readonly string[]).includes(script)) {
      validateGuardedArgs(script as ReadOnlyScript, args);
      result = await runReadOnlyScript(fmHome, script as ReadOnlyScript, args);
    } else if ((MUTATING_SCRIPTS as readonly string[]).includes(script)) {
      validateGuardedArgs(script as MutatingScript, args);
      result = await runMutatingScript(fmHome, script as MutatingScript, args);
    } else {
      throw new GuardedActionError(`${script} is not an advanced-drawer script`);
    }
    const outcome: GuardedActionResult = {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
    recordAudit({ script, args, ok: outcome.ok, summary: summarize(outcome) });
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordGuardedActionDenial(script, args, message);
  }
}
