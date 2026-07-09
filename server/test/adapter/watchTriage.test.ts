import { describe, expect, it } from "vitest";
import { parseWatchTriageLog } from "../../src/adapter/watchTriage.js";

describe("parseWatchTriageLog", () => {
  it("parses `[timestamp] message` lines and their epoch", () => {
    const entries = parseWatchTriageLog(
      "[2026-07-08T14:23:45+0100] absorbed stale wake for task-a1 (window busy)\n" +
        "[2026-07-08T14:24:10+0100] heartbeat scan clean\n",
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      timestampMs: Date.parse("2026-07-08T14:23:45+0100"),
      message: "absorbed stale wake for task-a1 (window busy)",
      raw: "[2026-07-08T14:23:45+0100] absorbed stale wake for task-a1 (window busy)",
    });
  });

  it("skips blank lines", () => {
    expect(parseWatchTriageLog("\n\n[2026-07-08T00:00:00+0000] noop\n\n")).toHaveLength(1);
  });

  it("keeps a malformed line verbatim with a null timestamp", () => {
    const entries = parseWatchTriageLog("not a triage line\n");
    expect(entries).toEqual([{ timestampMs: null, message: "not a triage line", raw: "not a triage line" }]);
  });
});
