import { describe, expect, it } from "vitest";
import type { CrewStateOutput, FleetTask } from "@fm-web/shared";
import { buildDecisionsInbox } from "../../src/adapter/decisions.js";

function task(id: string, crewState: CrewStateOutput, statusRaw?: string): FleetTask {
  return {
    id,
    meta: { kind: "ship", extra: {} },
    crewState,
    latestStatus:
      statusRaw === undefined
        ? null
        : { verb: "unknown", rawVerb: statusRaw.split(":")[0] ?? "", note: "", raw: statusRaw },
    captainRelevant: false,
    backlogRef: null,
    worktreePresent: true,
  };
}

describe("buildDecisionsInbox", () => {
  it("categorizes a run-step parked state as a no-mistakes gate, verbatim from crew-state detail", () => {
    const items = buildDecisionsInbox([
      task("t1", {
        state: "parked",
        source: "run-step",
        detail: "parked at review: 3 finding(s) (ask-user: captain decision)",
      }),
    ]);
    expect(items).toEqual([
      {
        taskId: "t1",
        category: "parked-gate",
        detail: "parked at review: 3 finding(s) (ask-user: captain decision)",
        source: "run-step",
      },
    ]);
  });

  it("categorizes a status-log parked state as needs-decision, preferring the verbatim status line", () => {
    const items = buildDecisionsInbox([
      task(
        "t2",
        { state: "parked", source: "status-log", detail: "found two possible root causes" },
        "needs-decision: found two possible root causes",
      ),
    ]);
    expect(items).toEqual([
      {
        taskId: "t2",
        category: "needs-decision",
        detail: "needs-decision: found two possible root causes",
        source: "status-log",
      },
    ]);
  });

  it("falls back to crew-state detail when there is no status line", () => {
    const items = buildDecisionsInbox([
      task("t3", { state: "parked", source: "status-log", detail: "captain decision needed" }),
    ]);
    expect(items[0]?.detail).toBe("captain decision needed");
  });

  it("surfaces done, blocked and failed crew states", () => {
    const items = buildDecisionsInbox([
      task("t4", { state: "done", source: "run-step", detail: "checks green: PR ready for review" }),
      task(
        "t5",
        { state: "blocked", source: "status-log", detail: "waiting on upstream" },
        "blocked: waiting on upstream",
      ),
      task("t6", { state: "failed", source: "run-step", detail: "run failed" }),
    ]);
    expect(items.map((i) => i.category)).toEqual(["done", "blocked", "failed"]);
  });

  it("ignores working and unknown crew states", () => {
    const items = buildDecisionsInbox([
      task("t7", { state: "working", source: "pane", detail: "harness busy" }),
      task("t8", { state: "unknown", source: "none", detail: "worktree gone" }),
    ]);
    expect(items).toEqual([]);
  });
});
