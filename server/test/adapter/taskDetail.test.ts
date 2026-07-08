import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTaskDetail } from "../../src/adapter/taskDetail.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fm-home");

describe("buildTaskDetail", () => {
  it("returns null for an unknown task id", async () => {
    expect(await buildTaskDetail(FIXTURE_HOME, "no-such-task")).toBeNull();
  });

  it("reads meta, full status history, brief/report and an unarmed PR status from fixtures", async () => {
    const detail = await buildTaskDetail(FIXTURE_HOME, "task-b2");
    expect(detail).not.toBeNull();
    expect(detail?.meta.kind).toBe("scout");
    expect(detail?.statusHistory.map((entry) => entry.verb)).toEqual(["working", "needs-decision"]);
    expect(detail?.brief).toContain("Fixture scout brief for task-b2");
    expect(detail?.report).toContain("Fixture scout report for task-b2");
    expect(detail?.pr).toEqual({ url: null, headSha: null, pollArmed: false, pollTargetUrl: null });
    // Fixture worktree deliberately doesn't exist on disk; no run to poll.
    expect(detail?.gateStatusRaw).toBeNull();
  });

  it("reports report as null when only a brief exists", async () => {
    const detail = await buildTaskDetail(FIXTURE_HOME, "task-a1");
    expect(detail?.brief).toContain("Fixture brief for task-a1");
    expect(detail?.report).toBeNull();
  });

  it("parses an armed PR poll and the pr=/pr_head= meta fields", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      writeFileSync(
        join(fmHome, "state", "task-c3.meta"),
        "kind=ship\npr=https://github.com/korallis/fm-web/pull/9\npr_head=deadbeef\n",
      );
      writeFileSync(
        join(fmHome, "state", "task-c3.check.sh"),
        'state=$(gh pr view "https://github.com/korallis/fm-web/pull/9" --json state -q .state 2>/dev/null)\n[ "$state" = "MERGED" ] && echo "merged"\n',
      );

      const detail = await buildTaskDetail(fmHome, "task-c3");

      expect(detail?.pr).toEqual({
        url: "https://github.com/korallis/fm-web/pull/9",
        headSha: "deadbeef",
        pollArmed: true,
        pollTargetUrl: "https://github.com/korallis/fm-web/pull/9",
      });
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("skips the gate-status call for a scout (no no-mistakes run to attribute)", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    const worktree = join(fmHome, "worktree");
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      mkdirSync(worktree, { recursive: true });
      writeFileSync(join(fmHome, "state", "task-d4.meta"), `kind=scout\nworktree=${worktree}\n`);

      const detail = await buildTaskDetail(fmHome, "task-d4");

      expect(detail?.gateStatusRaw).toBeNull();
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("decodes-ready: fetches raw TOON gate status for a ship task with a real worktree", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    const worktree = join(fmHome, "worktree");
    const binDir = join(fmHome, "stub-bin");
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      mkdirSync(worktree, { recursive: true });
      mkdirSync(binDir, { recursive: true });
      writeFileSync(join(fmHome, "state", "task-e5.meta"), `kind=ship\nworktree=${worktree}\n`);
      const stubPath = join(binDir, "no-mistakes");
      writeFileSync(stubPath, "#!/bin/sh\nprintf 'run:\\n  status: completed\\noutcome: passed\\n'\n");
      chmodSync(stubPath, 0o755);

      const originalPath = process.env["PATH"];
      process.env["PATH"] = `${binDir}:${originalPath ?? ""}`;
      try {
        const detail = await buildTaskDetail(fmHome, "task-e5");
        expect(detail?.gateStatusRaw).toContain("outcome: passed");
      } finally {
        if (originalPath === undefined) delete process.env["PATH"];
        else process.env["PATH"] = originalPath;
      }
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });
});
