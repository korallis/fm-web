import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildFleetSnapshot } from "../../src/adapter/fleetState.js";
import { DEFAULT_TIMING } from "../../src/adapter/timing.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "fm-home");
const BEACON_MTIME_MS = statSync(join(FIXTURE_HOME, "state", ".last-watcher-beat")).mtimeMs;

describe("buildFleetSnapshot against the sanitized fixture home", () => {
  it("recovers both fixture tasks from state/*.meta filenames", () => {
    const snapshot = buildFleetSnapshot(FIXTURE_HOME);
    const ids = snapshot.tasks.map((t) => t.id).sort();
    expect(ids).toEqual(["task-a1", "task-b2"]);
  });

  it("attaches the latest status entry and captain-relevance per task", () => {
    const snapshot = buildFleetSnapshot(FIXTURE_HOME);
    const taskA1 = snapshot.tasks.find((t) => t.id === "task-a1");
    const taskB2 = snapshot.tasks.find((t) => t.id === "task-b2");

    expect(taskA1?.latestStatus?.verb).toBe("done");
    expect(taskA1?.captainRelevant).toBe(true);

    expect(taskB2?.latestStatus?.verb).toBe("needs-decision");
    expect(taskB2?.captainRelevant).toBe(true);
    expect(taskB2?.meta.kind).toBe("scout");
  });

  it("marks worktreePresent false when the meta worktree path does not exist on disk", () => {
    const snapshot = buildFleetSnapshot(FIXTURE_HOME);
    const taskA1 = snapshot.tasks.find((t) => t.id === "task-a1");
    expect(taskA1?.worktreePresent).toBe(false);
  });

  it("cross-references the in-flight backlog entry for a spawned task", () => {
    const snapshot = buildFleetSnapshot(FIXTURE_HOME);
    const taskA1 = snapshot.tasks.find((t) => t.id === "task-a1");
    expect(taskA1?.backlogRef?.id).toBe("task-a1");
  });

  it("parses projects, secondmates and backlog lanes from the fixture data dir", () => {
    const snapshot = buildFleetSnapshot(FIXTURE_HOME);
    expect(snapshot.projects.map((p) => p.name)).toContain("demo-repo");
    expect(snapshot.secondmates.map((s) => s.id)).toContain("demo-secondmate");
    expect(snapshot.backlog.done).toHaveLength(2);
  });

  it("builds supervision health from the fixture lock/beacon/afk files", () => {
    const snapshot = buildFleetSnapshot(FIXTURE_HOME);
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

  it("marks the beacon fresh when nowMs is just past its mtime", () => {
    const snapshot = buildFleetSnapshot(FIXTURE_HOME, BEACON_MTIME_MS + 10_000);
    expect(snapshot.supervision.beaconFresh).toBe(true);
  });

  it("marks the beacon stale once older than the guard grace window", () => {
    const snapshot = buildFleetSnapshot(FIXTURE_HOME, BEACON_MTIME_MS + 400_000);
    expect(snapshot.supervision.beaconFresh).toBe(false);
  });

  it("skips a task whose meta entry vanishes before it is read", () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      symlinkSync("missing-target.meta", join(fmHome, "state", "vanished.meta"));

      const snapshot = buildFleetSnapshot(fmHome);

      expect(snapshot.tasks).toEqual([]);
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("marks a dead lock pid as stale", () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      mkdirSync(join(fmHome, "data"), { recursive: true });
      writeFileSync(join(fmHome, "state", "task-a1.meta"), "kind=ship\n");
      writeFileSync(join(fmHome, "state", ".lock"), "999999\n");

      const snapshot = buildFleetSnapshot(fmHome);

      expect(snapshot.supervision.lock).toEqual({ pid: 999999, alive: false });
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("applies caller-supplied timing and captain relevance configuration", () => {
    const snapshot = buildFleetSnapshot(
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
