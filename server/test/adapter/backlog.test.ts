import { describe, expect, it } from "vitest";
import { parseBacklog } from "../../src/adapter/backlog.js";

const FIXTURE = `## In flight
- [ ] task-a1 - Demo ship task: scaffold widget module (repo: demo-repo) (kind: ship) (since 2026-06-01)

## Queued
- [ ] task-c3 - Demo queued task waiting on dependency (repo: demo-repo) (kind: ship) blocked-by: task-a1 - needs shared widget module first

## Done
- [x] task-z9 - Demo done task shipped via PR https://github.com/example/demo-repo/pull/42 (repo: demo-repo) (kind: ship) (merged 2026-05-20)
- [x] task-y8 - Demo done task merged locally (repo: demo-repo) (kind: ship) (done 2026-05-18)
  local main (demo-repo)
`;

describe("parseBacklog", () => {
  it("parses the In flight lane with parenthetical fields", () => {
    const { inFlight } = parseBacklog(FIXTURE);
    expect(inFlight).toEqual([
      {
        id: "task-a1",
        description: "Demo ship task: scaffold widget module",
        repo: "demo-repo",
        kindTag: "ship",
        since: "2026-06-01",
      },
    ]);
  });

  it("parses bold In flight items", () => {
    const { inFlight } = parseBacklog(`## In flight
- **task-b2** - Active handoff task (repo: demo-repo) (kind: scout) (since 2026-06-03)
`);

    expect(inFlight).toEqual([
      {
        id: "task-b2",
        description: "Active handoff task",
        repo: "demo-repo",
        kindTag: "scout",
        since: "2026-06-03",
      },
    ]);
  });

  it("parses comma-separated fields inside one parenthetical group", () => {
    const { inFlight } = parseBacklog(`## In flight
- **task-b2** - Active handoff task (repo: demo-repo, since 2026-06-03)
`);

    expect(inFlight).toEqual([
      {
        id: "task-b2",
        description: "Active handoff task",
        repo: "demo-repo",
        since: "2026-06-03",
      },
    ]);
  });

  it("parses the Queued lane with a blocked-by clause", () => {
    const { queued } = parseBacklog(FIXTURE);
    expect(queued).toEqual([
      {
        id: "task-c3",
        description: "Demo queued task waiting on dependency",
        repo: "demo-repo",
        kindTag: "ship",
        blockedBy: { id: "task-a1", reason: "needs shared widget module first" },
      },
    ]);
  });

  it("parses a Done item with an inline PR URL", () => {
    const { done } = parseBacklog(FIXTURE);
    expect(done[0]).toEqual({
      id: "task-z9",
      description: "Demo done task shipped via PR",
      mergeTarget: "https://github.com/example/demo-repo/pull/42",
      repo: "demo-repo",
      kindTag: "ship",
      dateLabel: "merged",
      date: "2026-05-20",
    });
  });

  it("parses a Done item whose merge target is on an indented continuation line", () => {
    const { done } = parseBacklog(FIXTURE);
    expect(done[1]).toEqual({
      id: "task-y8",
      description: "Demo done task merged locally",
      mergeTarget: "local main (demo-repo)",
      repo: "demo-repo",
      kindTag: "ship",
      dateLabel: "done",
      date: "2026-05-18",
    });
  });

  it("strips adjacent separators when extracting inline Done merge targets", () => {
    const { done } = parseBacklog(`## Done
- [x] task-u1 - Demo done via PR - https://github.com/example/demo-repo/pull/42 (merged 2026-05-20)
- [x] task-r2 - Demo reported completion - data/task-r2/report.md (reported 2026-05-21)
- [x] task-l3 - Demo local merge - local main (done 2026-05-22)
`);

    expect(done).toEqual([
      {
        id: "task-u1",
        description: "Demo done via PR",
        mergeTarget: "https://github.com/example/demo-repo/pull/42",
        dateLabel: "merged",
        date: "2026-05-20",
      },
      {
        id: "task-r2",
        description: "Demo reported completion",
        mergeTarget: "data/task-r2/report.md",
        dateLabel: "reported",
        date: "2026-05-21",
      },
      {
        id: "task-l3",
        description: "Demo local merge",
        mergeTarget: "local main",
        dateLabel: "done",
        date: "2026-05-22",
      },
    ]);
  });

  it("returns empty lanes for content with no matching sections", () => {
    expect(parseBacklog("# Not a backlog file\n")).toEqual({ inFlight: [], queued: [], done: [] });
  });
});
