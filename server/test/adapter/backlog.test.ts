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

  it("returns empty lanes for content with no matching sections", () => {
    expect(parseBacklog("# Not a backlog file\n")).toEqual({ inFlight: [], queued: [], done: [] });
  });
});
