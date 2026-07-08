import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { runMutatingScript, runReadOnlyScript, ScriptGuardError } from "../../src/safety/scriptRunner.js";
import { MUTATING_SCRIPTS, NEVER_RUN_SCRIPTS, READ_ONLY_SCRIPTS } from "../../src/safety/allowlist.js";
import type { MutatingScript, ReadOnlyScript } from "../../src/safety/allowlist.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fm-home");

interface FirstmatePathOverrideEnv {
  FM_ROOT: string | undefined;
  FM_ROOT_OVERRIDE: string | undefined;
  FM_STATE_OVERRIDE: string | undefined;
  FM_DATA_OVERRIDE: string | undefined;
  FM_PROJECTS_OVERRIDE: string | undefined;
  FM_CONFIG_OVERRIDE: string | undefined;
}

function restoreEnv(original: FirstmatePathOverrideEnv): void {
  if (original.FM_ROOT === undefined) delete process.env["FM_ROOT"];
  else process.env["FM_ROOT"] = original.FM_ROOT;
  if (original.FM_ROOT_OVERRIDE === undefined) delete process.env["FM_ROOT_OVERRIDE"];
  else process.env["FM_ROOT_OVERRIDE"] = original.FM_ROOT_OVERRIDE;
  if (original.FM_STATE_OVERRIDE === undefined) delete process.env["FM_STATE_OVERRIDE"];
  else process.env["FM_STATE_OVERRIDE"] = original.FM_STATE_OVERRIDE;
  if (original.FM_DATA_OVERRIDE === undefined) delete process.env["FM_DATA_OVERRIDE"];
  else process.env["FM_DATA_OVERRIDE"] = original.FM_DATA_OVERRIDE;
  if (original.FM_PROJECTS_OVERRIDE === undefined) delete process.env["FM_PROJECTS_OVERRIDE"];
  else process.env["FM_PROJECTS_OVERRIDE"] = original.FM_PROJECTS_OVERRIDE;
  if (original.FM_CONFIG_OVERRIDE === undefined) delete process.env["FM_CONFIG_OVERRIDE"];
  else process.env["FM_CONFIG_OVERRIDE"] = original.FM_CONFIG_OVERRIDE;
}

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

  it("clears firstmate path overrides before running child scripts", async () => {
    const originalEnv: FirstmatePathOverrideEnv = {
      FM_ROOT: process.env["FM_ROOT"],
      FM_ROOT_OVERRIDE: process.env["FM_ROOT_OVERRIDE"],
      FM_STATE_OVERRIDE: process.env["FM_STATE_OVERRIDE"],
      FM_DATA_OVERRIDE: process.env["FM_DATA_OVERRIDE"],
      FM_PROJECTS_OVERRIDE: process.env["FM_PROJECTS_OVERRIDE"],
      FM_CONFIG_OVERRIDE: process.env["FM_CONFIG_OVERRIDE"],
    };
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "bin"), { recursive: true });
      writeFileSync(
        join(fmHome, "bin", "fm-peek.sh"),
        [
          "#!/bin/sh",
          "printf 'home=%s\\nroot=%s\\nroot_override=%s\\nstate=%s\\ndata=%s\\nprojects=%s\\nconfig=%s\\n' \\",
          '  "$FM_HOME" "${FM_ROOT-unset}" "${FM_ROOT_OVERRIDE-unset}" "${FM_STATE_OVERRIDE-unset}" \\',
          '  "${FM_DATA_OVERRIDE-unset}" "${FM_PROJECTS_OVERRIDE-unset}" "${FM_CONFIG_OVERRIDE-unset}"',
        ].join("\n"),
      );
      chmodSync(join(fmHome, "bin", "fm-peek.sh"), 0o755);
      process.env["FM_ROOT"] = "/wrong/root-var";
      process.env["FM_ROOT_OVERRIDE"] = "/wrong/root";
      process.env["FM_STATE_OVERRIDE"] = "/wrong/state";
      process.env["FM_DATA_OVERRIDE"] = "/wrong/data";
      process.env["FM_PROJECTS_OVERRIDE"] = "/wrong/projects";
      process.env["FM_CONFIG_OVERRIDE"] = "/wrong/config";

      const result = await runReadOnlyScript(fmHome, "fm-peek.sh", []);

      expect(result.stdout).toContain(`home=${fmHome}`);
      expect(result.stdout).toContain("root=unset");
      expect(result.stdout).toContain("root_override=unset");
      expect(result.stdout).toContain("state=unset");
      expect(result.stdout).toContain("data=unset");
      expect(result.stdout).toContain("projects=unset");
      expect(result.stdout).toContain("config=unset");
    } finally {
      restoreEnv(originalEnv);
      rmSync(fmHome, { recursive: true, force: true });
    }
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
