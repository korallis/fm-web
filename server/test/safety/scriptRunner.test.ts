import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { runMutatingScript, runReadOnlyScript, ScriptGuardError } from "../../src/safety/scriptRunner.js";
import { MUTATING_SCRIPTS, NEVER_RUN_SCRIPTS, READ_ONLY_SCRIPTS } from "../../src/safety/allowlist.js";
import type { MutatingScript, ReadOnlyScript } from "../../src/safety/allowlist.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fm-home");

describe("runReadOnlyScript", () => {
  it("executes an allowlisted read-only script end to end", async () => {
    const result = await runReadOnlyScript(FIXTURE_HOME, "fm-peek.sh", ["some-target"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("stub peek output for some-target");
  });

  it("executes an allowlisted script when FM_HOME is relative", async () => {
    const result = await runReadOnlyScript(relative(process.cwd(), FIXTURE_HOME), "fm-peek.sh", [
      "relative-home",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("stub peek output for relative-home");
  });

  it("allows fm-lock.sh with exactly a single 'status' argument", async () => {
    const result = await runReadOnlyScript(FIXTURE_HOME, "fm-lock.sh", ["status"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("lock:");
  });

  it("refuses fm-lock.sh with 'acquire' — that mutates state/.lock", async () => {
    await expect(runReadOnlyScript(FIXTURE_HOME, "fm-lock.sh", ["acquire"])).rejects.toThrow(
      ScriptGuardError,
    );
  });

  it("refuses bare fm-lock.sh with no arguments", async () => {
    await expect(runReadOnlyScript(FIXTURE_HOME, "fm-lock.sh", [])).rejects.toThrow(ScriptGuardError);
  });

  for (const forbidden of NEVER_RUN_SCRIPTS) {
    it(`NEVER runs ${forbidden}, even if a caller mislabels it read-only`, async () => {
      await expect(
        runReadOnlyScript(FIXTURE_HOME, forbidden as unknown as ReadOnlyScript, []),
      ).rejects.toThrow(ScriptGuardError);
    });
  }

  it("refuses a script that is not on the read-only allowlist at all", async () => {
    await expect(
      runReadOnlyScript(FIXTURE_HOME, "fm-brief.sh" as unknown as ReadOnlyScript, []),
    ).rejects.toThrow(ScriptGuardError);
  });

  it("refuses a script name containing path separators (traversal attempt)", async () => {
    await expect(
      runReadOnlyScript(FIXTURE_HOME, "../fm-peek.sh" as unknown as ReadOnlyScript, []),
    ).rejects.toThrow(ScriptGuardError);
  });

  it("accepts every documented read-only script name as a known literal", () => {
    // Compile-time check: this only type-checks if the allowlist matches the safety contract.
    const scripts: readonly ReadOnlyScript[] = READ_ONLY_SCRIPTS;
    expect(scripts).toEqual([
      "fm-peek.sh",
      "fm-crew-state.sh",
      "fm-project-mode.sh",
      "fm-review-diff.sh",
      "fm-lock.sh",
    ]);
  });
});

describe("runMutatingScript — Phase 1 refuses ALL mutating scripts", () => {
  for (const script of MUTATING_SCRIPTS) {
    it(`refuses ${script}`, () => {
      expect(() => runMutatingScript(FIXTURE_HOME, script, [])).toThrow(ScriptGuardError);
    });
  }

  it("refuses a script that is not on the mutating allowlist either", () => {
    expect(() => runMutatingScript(FIXTURE_HOME, "fm-peek.sh" as unknown as MutatingScript, [])).toThrow(
      ScriptGuardError,
    );
  });

  for (const forbidden of NEVER_RUN_SCRIPTS) {
    it(`NEVER runs ${forbidden} via the mutating path either`, () => {
      expect(() => runMutatingScript(FIXTURE_HOME, forbidden as unknown as MutatingScript, [])).toThrow(
        ScriptGuardError,
      );
    });
  }
});
