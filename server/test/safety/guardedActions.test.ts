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

  it("accepts the drawer's fm-spawn.sh argv shape", () => {
    expect(() =>
      validateGuardedArgs("fm-spawn.sh", [
        "task-a1",
        "/tmp/project",
        "--harness",
        "claude",
        "--model",
        "sonnet",
        "--effort",
        "high",
        "--scout",
      ]),
    ).not.toThrow();
  });

  it("rejects a missing first argument", () => {
    expect(() => validateGuardedArgs("fm-teardown.sh", [])).toThrow(GuardedActionError);
  });

  it("rejects an unsafe task id (path separators)", () => {
    expect(() => validateGuardedArgs("fm-teardown.sh", ["../escape"])).toThrow(GuardedActionError);
  });

  it("does not require a task id for scripts without a task-id first argument", () => {
    expect(() => validateGuardedArgs("fm-watch-arm.sh", ["--restart"])).not.toThrow();
  });

  it("rejects fm-spawn.sh modes the drawer cannot produce", () => {
    expect(() =>
      validateGuardedArgs("fm-spawn.sh", ["task-a1", "/tmp/project", "--secondmate", "--harness", "claude"]),
    ).toThrow(GuardedActionError);
  });

  it("rejects extra args for fixed-shape advanced actions", () => {
    expect(() =>
      validateGuardedArgs("fm-pr-merge.sh", ["task-a1", "https://example.test/pr/1", "--admin"]),
    ).toThrow(GuardedActionError);
    expect(() => validateGuardedArgs("fm-promote.sh", ["task-a1", "--force"])).toThrow(GuardedActionError);
  });

  it("rejects fm-send.sh keys outside the unstick interrupt shape", () => {
    expect(() => validateGuardedArgs("fm-send.sh", ["task-a1", "--key", "C-d"])).toThrow(GuardedActionError);
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

  it("refuses fm-watch-arm.sh from the synchronous guarded-action entry point", async () => {
    const result = await runGuardedAction(FIXTURE_HOME, "fm-watch-arm.sh", []);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not an advanced-drawer script/);
  });

  it("refuses an unknown script name", async () => {
    const result = await runGuardedAction(FIXTURE_HOME, "not-a-real-script.sh", []);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not an advanced-drawer script/);
  });
});
