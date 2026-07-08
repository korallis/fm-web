import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFleetSnapshot } from "../../src/adapter/fleetState.js";

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
});
