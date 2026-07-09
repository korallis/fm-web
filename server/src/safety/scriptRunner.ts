import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { binDir } from "../adapter/paths.js";
import { MUTATING_SCRIPTS, NEVER_RUN_SCRIPTS, READ_ONLY_SCRIPTS } from "./allowlist.js";
import type { MutatingScript, ReadOnlyScript } from "./allowlist.js";

export class ScriptGuardError extends Error {}

export interface ScriptResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface ScriptRunLimits {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

interface NormalizedScriptRunLimits {
  timeoutMs: number;
  maxOutputBytes: number;
}

const DEFAULT_SCRIPT_TIMEOUT_MS = 5_000;
const DEFAULT_SCRIPT_MAX_OUTPUT_BYTES = 1024 * 1024;
const SCRIPT_TERMINATION_GRACE_MS = 1_000;
type KillSignal = "SIGTERM" | "SIGKILL";

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : fallback;
}

function normalizeScriptRunLimits(limits: ScriptRunLimits): NormalizedScriptRunLimits {
  return {
    timeoutMs: normalizePositiveInteger(limits.timeoutMs, DEFAULT_SCRIPT_TIMEOUT_MS),
    maxOutputBytes: normalizePositiveInteger(limits.maxOutputBytes, DEFAULT_SCRIPT_MAX_OUTPUT_BYTES),
  };
}

/** `fm-lock.sh` is read-only ONLY for `status`; bare/`acquire` invocations mutate `state/.lock`. */
function assertLockArgsSafe(scriptName: string, args: readonly string[]): void {
  if (scriptName !== "fm-lock.sh") return;
  if (args.length !== 1 || args[0] !== "status") {
    throw new ScriptGuardError(
      `fm-lock.sh may only be run with a single "status" argument in this app (got: ${JSON.stringify(args)})`,
    );
  }
}

interface ResolvedScript {
  fmHome: string;
  scriptPath: string;
}

function resolveScriptPath(fmHome: string, scriptName: string): ResolvedScript {
  if (scriptName.includes("/") || scriptName.includes("\\") || scriptName.includes("..")) {
    throw new ScriptGuardError(`refusing script name with path separators: ${scriptName}`);
  }
  const resolvedFmHome = resolve(fmHome);
  const resolvedBinDir = binDir(resolvedFmHome);
  const resolved = resolve(resolvedBinDir, scriptName);
  if (dirname(resolved) !== resolvedBinDir) {
    throw new ScriptGuardError(`resolved script path escapes bin/: ${resolved}`);
  }
  return { fmHome: resolvedFmHome, scriptPath: resolved };
}

function buildScriptEnv(fmHome: string): Record<string, string | undefined> {
  const source: Record<string, string | undefined> = { ...process.env, FM_HOME: fmHome };
  const {
    FM_ROOT: _fmRoot,
    FM_ROOT_OVERRIDE: _fmRootOverride,
    FM_STATE_OVERRIDE: _fmStateOverride,
    FM_DATA_OVERRIDE: _fmDataOverride,
    FM_PROJECTS_OVERRIDE: _fmProjectsOverride,
    FM_CONFIG_OVERRIDE: _fmConfigOverride,
    ...env
  } = source;
  return env;
}

function runSpawn(
  scriptPath: string,
  args: readonly string[],
  fmHome: string,
  limits: NormalizedScriptRunLimits,
): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(scriptPath, args, {
      cwd: fmHome,
      env: buildScriptEnv(fmHome),
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    let terminationTimer: ReturnType<typeof setTimeout> | undefined;
    const timeoutTimer = setTimeout(() => {
      rejectWithGuardError(`script timed out after ${limits.timeoutMs}ms: ${scriptPath}`);
    }, limits.timeoutMs);

    const clearTimers = (): void => {
      clearTimeout(timeoutTimer);
      if (terminationTimer !== undefined) clearTimeout(terminationTimer);
    };

    const signalChild = (signal: KillSignal): void => {
      if (child.pid !== undefined && process.platform !== "win32") {
        try {
          process.kill(-child.pid, signal);
          return;
        } catch {
          child.kill(signal);
          return;
        }
      }
      child.kill(signal);
    };

    const terminateChild = (): void => {
      signalChild("SIGTERM");
      terminationTimer = setTimeout(() => signalChild("SIGKILL"), SCRIPT_TERMINATION_GRACE_MS);
      child.once("close", () => {
        if (terminationTimer !== undefined) clearTimeout(terminationTimer);
      });
    };

    function rejectWithGuardError(message: string): void {
      if (settled) return;
      settled = true;
      clearTimers();
      terminateChild();
      reject(new ScriptGuardError(message));
    }

    const appendOutput = (streamName: "stdout" | "stderr", chunk: Buffer): void => {
      if (settled) return;
      outputBytes += chunk.byteLength;
      if (outputBytes > limits.maxOutputBytes) {
        rejectWithGuardError(`script output exceeded ${limits.maxOutputBytes} bytes: ${scriptPath}`);
        return;
      }
      if (streamName === "stdout") stdout += chunk.toString();
      else stderr += chunk.toString();
    };

    child.stdout.on("data", (chunk: Buffer) => appendOutput("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => appendOutput("stderr", chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(error);
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve({ exitCode, stdout, stderr });
    });
  });
}

/**
 * Run a read-only firstmate script (`bin/<script>` under `fmHome`). Refuses anything not on
 * `READ_ONLY_SCRIPTS`, and never a `NEVER_RUN_SCRIPTS` entry regardless of caller intent.
 */
export async function runReadOnlyScript(
  fmHome: string,
  scriptName: ReadOnlyScript,
  args: readonly string[] = [],
  limits: ScriptRunLimits = {},
): Promise<ScriptResult> {
  if ((NEVER_RUN_SCRIPTS as readonly string[]).includes(scriptName)) {
    throw new ScriptGuardError(`refusing to ever run ${scriptName} from this app`);
  }
  if (!(READ_ONLY_SCRIPTS as readonly string[]).includes(scriptName)) {
    throw new ScriptGuardError(`${scriptName} is not on the read-only allowlist`);
  }
  assertLockArgsSafe(scriptName, args);
  const resolved = resolveScriptPath(fmHome, scriptName);
  return runSpawn(resolved.scriptPath, args, resolved.fmHome, normalizeScriptRunLimits(limits));
}

/**
 * The current read-only deck refuses every mutating script categorically. The allowlist documents
 * the scripts a later mutating surface may choose from, but nothing calls through today.
 */
export function runMutatingScript(
  _fmHome: string,
  scriptName: MutatingScript,
  _args: readonly string[] = [],
): never {
  if ((NEVER_RUN_SCRIPTS as readonly string[]).includes(scriptName)) {
    throw new ScriptGuardError(`refusing to ever run ${scriptName} from this app`);
  }
  if (!(MUTATING_SCRIPTS as readonly string[]).includes(scriptName)) {
    throw new ScriptGuardError(`${scriptName} is not on the mutating allowlist`);
  }
  throw new ScriptGuardError(`mutating scripts are disabled in Phase 1 (refused: ${scriptName})`);
}

/** Explicit guard callers can check ad hoc, for names that may not even be typed as a script literal. */
export function assertNeverRun(scriptName: string): void {
  if ((NEVER_RUN_SCRIPTS as readonly string[]).includes(scriptName)) {
    throw new ScriptGuardError(`refusing to ever run ${scriptName} from this app`);
  }
}
