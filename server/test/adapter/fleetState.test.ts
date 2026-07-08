import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildFleetSnapshot } from "../../src/adapter/fleetState.js";
import { DEFAULT_TIMING } from "../../src/adapter/timing.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fm-home");
const BEACON_MTIME_MS = statSync(join(FIXTURE_HOME, "state", ".last-watcher-beat")).mtimeMs;

describe("buildFleetSnapshot against the sanitized fixture home", () => {
  it("recovers both fixture tasks from state/*.meta filenames", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME);
    const ids = snapshot.tasks.map((t) => t.id).sort();
    expect(ids).toEqual(["task-a1", "task-b2"]);
  });

  it("attaches crew state, latest status entry and captain-relevance per task", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME);
    const taskA1 = snapshot.tasks.find((t) => t.id === "task-a1");
    const taskB2 = snapshot.tasks.find((t) => t.id === "task-b2");

    expect(taskA1?.crewState).toEqual({
      state: "unknown",
      source: "none",
      detail: "worktree gone: /tmp/fixture-home/projects/demo-repo",
    });
    expect(taskA1?.latestStatus?.verb).toBe("done");
    expect(taskA1?.captainRelevant).toBe(true);

    expect(taskB2?.crewState).toEqual({
      state: "unknown",
      source: "none",
      detail: "worktree gone: /tmp/fixture-home/projects/demo-repo-scout",
    });
    expect(taskB2?.latestStatus?.verb).toBe("needs-decision");
    expect(taskB2?.captainRelevant).toBe(true);
    expect(taskB2?.meta.kind).toBe("scout");
  });

  it("classifies captain relevance from crew-state detail", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "bin"), { recursive: true });
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      writeFileSync(join(fmHome, "state", "task-a1.meta"), "kind=ship\n");
      writeFileSync(join(fmHome, "state", "task-a1.status"), "working: routine update\n");
      writeFileSync(
        join(fmHome, "bin", "fm-crew-state.sh"),
        "#!/bin/sh\nprintf 'state: working \\302\\267 source: pane \\302\\267 PR ready for captain\\n'\n",
      );
      chmodSync(join(fmHome, "bin", "fm-crew-state.sh"), 0o755);

      const snapshot = await buildFleetSnapshot(fmHome, Date.now(), DEFAULT_TIMING, /PR ready/i);
      const task = snapshot.tasks.find((t) => t.id === "task-a1");

      expect(task?.crewState).toEqual({
        state: "working",
        source: "pane",
        detail: "PR ready for captain",
      });
      expect(task?.latestStatus?.verb).toBe("working");
      expect(task?.captainRelevant).toBe(true);
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("marks worktreePresent false when the meta worktree path does not exist on disk", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME);
    const taskA1 = snapshot.tasks.find((t) => t.id === "task-a1");
    expect(taskA1?.worktreePresent).toBe(false);
  });

  it("marks worktreePresent false when the meta worktree path is a file", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      const worktreePath = join(fmHome, "worktree-placeholder");
      mkdirSync(join(fmHome, "bin"), { recursive: true });
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      writeFileSync(worktreePath, "not a directory\n");
      writeFileSync(join(fmHome, "state", "task-a1.meta"), `kind=ship\nworktree=${worktreePath}\n`);
      writeFileSync(join(fmHome, "bin", "fm-crew-state.sh"), "#!/bin/sh\nprintf 'unknown (none): test\\n'\n");
      chmodSync(join(fmHome, "bin", "fm-crew-state.sh"), 0o755);

      const snapshot = await buildFleetSnapshot(fmHome);
      const taskA1 = snapshot.tasks.find((t) => t.id === "task-a1");

      expect(taskA1?.worktreePresent).toBe(false);
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("cross-references the in-flight backlog entry for a spawned task", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME);
    const taskA1 = snapshot.tasks.find((t) => t.id === "task-a1");
    expect(taskA1?.backlogRef?.id).toBe("task-a1");
  });

  it("parses projects, secondmates and backlog lanes from the fixture data dir", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME);
    expect(snapshot.projects.map((p) => p.name)).toContain("demo-repo");
    expect(snapshot.secondmates.map((s) => s.id)).toContain("demo-secondmate");
    expect(snapshot.backlog.done).toHaveLength(2);
  });

  it("builds supervision health from the fixture lock/beacon/afk files", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME);
    expect(snapshot.supervision.lock.pid).toBe(15356);
    expect(typeof snapshot.supervision.lock.alive).toBe("boolean");
    expect(snapshot.supervision.afk).toBe(false);
    expect(snapshot.supervision.beaconLastBeatMs).not.toBeNull();
    expect(snapshot.supervision.timing).toEqual({
      pollSeconds: 15,
      guardGraceSeconds: 300,
      heartbeatBaseSeconds: 600,
      heartbeatMaxSeconds: 7200,
      staleEscalateSeconds: 240,
      checkIntervalSeconds: 300,
    });
  });

  it("marks the beacon fresh when nowMs is just past its mtime", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME, BEACON_MTIME_MS + 10_000);
    expect(snapshot.supervision.beaconFresh).toBe(true);
  });

  it("marks the beacon stale once older than the guard grace window", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME, BEACON_MTIME_MS + 400_000);
    expect(snapshot.supervision.beaconFresh).toBe(false);
  });

  it("skips a task whose meta entry vanishes before it is read", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      symlinkSync("missing-target.meta", join(fmHome, "state", "vanished.meta"));

      const snapshot = await buildFleetSnapshot(fmHome);

      expect(snapshot.tasks).toEqual([]);
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("marks a dead lock pid as stale", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      writeFileSync(join(fmHome, "state", "task-a1.meta"), "kind=ship\n");
      writeFileSync(join(fmHome, "state", ".lock"), "999999\n");

      const snapshot = await buildFleetSnapshot(fmHome);

      expect(snapshot.supervision.lock).toEqual({ pid: 999999, alive: false });
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("marks a live non-harness lock pid as stale", async () => {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => undefined, 30_000)"], { stdio: "ignore" });
    const childPid = child.pid;
    if (childPid === undefined) throw new Error("failed to spawn child process");
    child.unref();

    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      writeFileSync(join(fmHome, "state", "task-a1.meta"), "kind=ship\n");
      writeFileSync(join(fmHome, "state", ".lock"), `${childPid}\n`);

      const snapshot = await buildFleetSnapshot(fmHome);

      expect(snapshot.supervision.lock).toEqual({ pid: childPid, alive: false });
    } finally {
      child.kill();
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("wires a parked run-step crew state into the decisions inbox as a no-mistakes gate", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "bin"), { recursive: true });
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      writeFileSync(join(fmHome, "state", "task-a1.meta"), "kind=ship\n");
      writeFileSync(
        join(fmHome, "bin", "fm-crew-state.sh"),
        "#!/bin/sh\nprintf 'state: parked \\302\\267 source: run-step \\302\\267 parked at review: 2 finding(s) (ask-user: captain decision)\\n'\n",
      );
      chmodSync(join(fmHome, "bin", "fm-crew-state.sh"), 0o755);

      const snapshot = await buildFleetSnapshot(fmHome);

      expect(snapshot.decisions).toEqual([
        {
          taskId: "task-a1",
          category: "parked-gate",
          detail: "parked at review: 2 finding(s) (ask-user: captain decision)",
          source: "run-step",
        },
      ]);
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("reads the wake-queue and watch-triage fixture files into the snapshot", async () => {
    const snapshot = await buildFleetSnapshot(FIXTURE_HOME);
    expect(snapshot.wakeQueue).toEqual([
      { epoch: 1783516268, seq: 271, kind: "signal", key: "task-a1_status", payload: "status updated" },
      { epoch: 1783516300, seq: 272, kind: "heartbeat", key: "fleet", payload: "periodic heartbeat scan" },
    ]);
    expect(snapshot.watchTriage).toEqual([
      {
        timestampMs: Date.parse("2026-06-01T09:00:00+0000"),
        message: "absorbed stale wake for task-a1 (window busy)",
        raw: "[2026-06-01T09:00:00+0000] absorbed stale wake for task-a1 (window busy)",
      },
      {
        timestampMs: Date.parse("2026-06-01T09:05:00+0000"),
        message: "heartbeat scan clean",
        raw: "[2026-06-01T09:05:00+0000] heartbeat scan clean",
      },
    ]);
  });

  it("returns empty wake-queue/watch-triage arrays when the files are absent", async () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });

      const snapshot = await buildFleetSnapshot(fmHome);

      expect(snapshot.wakeQueue).toEqual([]);
      expect(snapshot.watchTriage).toEqual([]);
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("applies caller-supplied timing and captain relevance configuration", async () => {
    const snapshot = await buildFleetSnapshot(
      FIXTURE_HOME,
      BEACON_MTIME_MS + 10_000,
      { ...DEFAULT_TIMING, guardGraceSeconds: 7 },
      /only-this-word/i,
    );

    expect(snapshot.supervision.timing.guardGraceSeconds).toBe(7);
    expect(snapshot.supervision.beaconFresh).toBe(false);
    expect(snapshot.tasks.find((t) => t.id === "task-a1")?.captainRelevant).toBe(false);
  });
});
