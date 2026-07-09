import type { GuardedActionResult } from "@fm-web/shared";
import { isSafeTaskId } from "../adapter/paths.js";
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
] as const satisfies readonly MutatingScript[];

export const ADVANCED_DRAWER_SCRIPTS = [
  ...ADVANCED_DRAWER_MUTATING_SCRIPTS,
  ...ADVANCED_DRAWER_READONLY_SCRIPTS,
] as const;

const GUARDED_MUTATING_SCRIPTS = [
  "fm-send.sh",
  ...ADVANCED_DRAWER_MUTATING_SCRIPTS,
] as const satisfies readonly MutatingScript[];

type GuardedScript =
  (typeof GUARDED_MUTATING_SCRIPTS)[number] | (typeof ADVANCED_DRAWER_READONLY_SCRIPTS)[number];

export function isAdvancedDrawerMutatingScript(script: string): script is MutatingScript {
  return (ADVANCED_DRAWER_MUTATING_SCRIPTS as readonly string[]).includes(script);
}

export function isAdvancedDrawerScript(script: string): boolean {
  return (ADVANCED_DRAWER_SCRIPTS as readonly string[]).includes(script);
}

function isGuardedMutatingScript(script: string): script is MutatingScript {
  return (GUARDED_MUTATING_SCRIPTS as readonly string[]).includes(script);
}

function requireTaskId(script: string, args: readonly string[]): void {
  const taskId = args[0];
  if (taskId === undefined || !isSafeTaskId(taskId)) {
    throw new GuardedActionError(`${script} requires a valid task id as its first argument`);
  }
}

function requireExactLength(script: string, args: readonly string[], length: number): void {
  if (args.length !== length) {
    throw new GuardedActionError(`${script} received invalid arguments`);
  }
}

function requireNonBlank(script: string, value: string | undefined): void {
  if (value === undefined || value.trim() === "") {
    throw new GuardedActionError(`${script} received invalid arguments`);
  }
}

function requireFlagValue(script: string, value: string | undefined): void {
  requireNonBlank(script, value);
  if (value?.startsWith("-") === true) {
    throw new GuardedActionError(`${script} received invalid arguments`);
  }
}

function validateOptionalFlag(script: string, args: readonly string[], index: number, flag: string): number {
  if (args[index] !== flag) return index;
  requireFlagValue(script, args[index + 1]);
  return index + 2;
}

function validateSpawnArgs(args: readonly string[]): void {
  const script = "fm-spawn.sh";
  requireTaskId(script, args);
  requireNonBlank(script, args[1]);
  if (args[2] !== "--harness") throw new GuardedActionError(`${script} received invalid arguments`);
  requireFlagValue(script, args[3]);
  let index = 4;
  index = validateOptionalFlag(script, args, index, "--model");
  index = validateOptionalFlag(script, args, index, "--effort");
  if (args[index] === "--scout") index += 1;
  if (index !== args.length) throw new GuardedActionError(`${script} received invalid arguments`);
}

function validateOneTaskArg(script: GuardedScript, args: readonly string[]): void {
  requireTaskId(script, args);
  requireExactLength(script, args, 1);
}

function validateTaskAndUrl(script: GuardedScript, args: readonly string[]): void {
  requireTaskId(script, args);
  requireExactLength(script, args, 2);
  requireNonBlank(script, args[1]);
}

function validateTeardownArgs(args: readonly string[]): void {
  const script = "fm-teardown.sh";
  requireTaskId(script, args);
  if (args.length === 1) return;
  if (args.length === 2 && args[1] === "--force") return;
  throw new GuardedActionError(`${script} received invalid arguments`);
}

function validateReviewDiffArgs(args: readonly string[]): void {
  const script = "fm-review-diff.sh";
  requireTaskId(script, args);
  if (args.length === 1) return;
  if (args.length === 2 && args[1] === "--stat") return;
  throw new GuardedActionError(`${script} received invalid arguments`);
}

function validateSendArgs(args: readonly string[]): void {
  const script = "fm-send.sh";
  requireTaskId(script, args);
  if (args.length === 2) {
    requireNonBlank(script, args[1]);
    return;
  }
  if (args.length === 3 && args[1] === "--key" && args[2] === "C-c") return;
  throw new GuardedActionError(`${script} received invalid arguments`);
}

export function validateGuardedArgs(script: MutatingScript | ReadOnlyScript, args: readonly string[]): void {
  switch (script) {
    case "fm-send.sh":
      validateSendArgs(args);
      return;
    case "fm-spawn.sh":
      validateSpawnArgs(args);
      return;
    case "fm-teardown.sh":
      validateTeardownArgs(args);
      return;
    case "fm-merge-local.sh":
    case "fm-promote.sh":
      validateOneTaskArg(script, args);
      return;
    case "fm-pr-check.sh":
    case "fm-pr-merge.sh":
      validateTaskAndUrl(script, args);
      return;
    case "fm-review-diff.sh":
      validateReviewDiffArgs(args);
      return;
  }
  if (!TASK_ID_FIRST_ARG_SCRIPTS.has(script)) return;
  requireTaskId(script, args);
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
    } else if (isGuardedMutatingScript(script)) {
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
