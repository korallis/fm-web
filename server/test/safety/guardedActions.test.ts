import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  GuardedActionError,
  previewCommandLine,
  runGuardedAction,
  validateGuardedArgs,
} from "../../src/safety/guardedActions.js";
import { clearAuditForTests, listAudit } from "../../src/safety/audit.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fm-home");

afterEach(() => {
  clearAuditForTests();
});

describe("validateGuardedArgs", () => {
  it("accepts a valid task id as the first argument for task-scoped scripts", () => {
    expect(() => validateGuardedArgs("fm-teardown.sh", ["task-a1", "--force"])).not.toThrow();
  });

  it("rejects a missing first argument", () => {
    expect(() => validateGuardedArgs("fm-teardown.sh", [])).toThrow(GuardedActionError);
  });

  it("rejects an unsafe task id (path separators)", () => {
    expect(() => validateGuardedArgs("fm-teardown.sh", ["../escape"])).toThrow(GuardedActionError);
  });

  it("does not require a task id for fm-watch-arm.sh (a global script)", () => {
    expect(() => validateGuardedArgs("fm-watch-arm.sh", ["--restart"])).not.toThrow();
    expect(() => validateGuardedArgs("fm-watch-arm.sh", [])).not.toThrow();
  });
});

describe("previewCommandLine", () => {
  it("joins the script and args for display", () => {
    expect(previewCommandLine("fm-teardown.sh", ["task-a1", "--force"])).toBe(
      "fm-teardown.sh task-a1 --force",
    );
  });
});

describe("runGuardedAction", () => {
  it("runs an allowlisted mutating script and records a successful audit entry", async () => {
    const result = await runGuardedAction(FIXTURE_HOME, "fm-send.sh", ["task-a1", "hello"]);
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain("stub sent to task-a1: hello");

    const audit = listAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.script).toBe("fm-send.sh");
    expect(audit[0]?.ok).toBe(true);
  });

  it("runs the read-only fm-review-diff.sh through the same entry point", async () => {
    // FIXTURE_HOME has no fm-review-diff.sh stub; the runner still executes it (ENOENT), and the
    // guarded action reports the failure instead of throwing.
    const result = await runGuardedAction(FIXTURE_HOME, "fm-review-diff.sh", ["task-a1"]);
    expect(result.ok).toBe(false);
    expect(listAudit()).toHaveLength(1);
  });

  it("rejects and audits a bad task id without ever spawning the script", async () => {
    const result = await runGuardedAction(FIXTURE_HOME, "fm-teardown.sh", ["../escape"]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid task id/);

    const audit = listAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.ok).toBe(false);
  });

  it("refuses fm-session-start.sh - never on either advanced-drawer allowlist", async () => {
    const result = await runGuardedAction(FIXTURE_HOME, "fm-session-start.sh", []);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not an advanced-drawer script/);
  });

  it("refuses an unknown script name", async () => {
    const result = await runGuardedAction(FIXTURE_HOME, "not-a-real-script.sh", []);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not an advanced-drawer script/);
  });
});
