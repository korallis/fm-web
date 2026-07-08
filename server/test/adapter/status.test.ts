import { describe, expect, it } from "vitest";
import { latestStatus, parseStatusLog } from "../../src/adapter/status.js";

describe("parseStatusLog", () => {
  it("splits verb and note on the first colon", () => {
    const entries = parseStatusLog("working: doing the thing: with a colon in the note\n");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      verb: "working",
      rawVerb: "working",
      note: "doing the thing: with a colon in the note",
    });
  });

  it("maps all five known verbs", () => {
    const content = ["working: a", "needs-decision: b", "blocked: c", "done: d", "failed: e"].join("\n");
    const entries = parseStatusLog(content);
    expect(entries.map((e) => e.verb)).toEqual(["working", "needs-decision", "blocked", "done", "failed"]);
  });

  it("passes unrecognized verbs through as unknown, defensively", () => {
    const entries = parseStatusLog("some-future-verb: whatever\n");
    expect(entries[0]?.verb).toBe("unknown");
    expect(entries[0]?.rawVerb).toBe("some-future-verb");
  });

  it("ignores blank lines and returns entries in file order", () => {
    const entries = parseStatusLog("working: a\n\ndone: b\n");
    expect(entries.map((e) => e.note)).toEqual(["a", "b"]);
  });
});

describe("latestStatus", () => {
  it("returns the last entry", () => {
    const entries = parseStatusLog("working: a\ndone: b\n");
    expect(latestStatus(entries)?.note).toBe("b");
  });

  it("returns null for an empty log", () => {
    expect(latestStatus([])).toBeNull();
  });
});
