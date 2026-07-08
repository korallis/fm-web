import { describe, expect, it } from "vitest";
import { parseWakeQueue } from "../../src/adapter/wakeQueue.js";

describe("parseWakeQueue", () => {
  it("parses tab-separated epoch/seq/kind/key/payload lines", () => {
    const content = "1783516268\t271\tsignal\ttask-a1_status\tstatus updated\n";
    const entries = parseWakeQueue(content);
    expect(entries).toEqual([
      { epoch: 1783516268, seq: 271, kind: "signal", key: "task-a1_status", payload: "status updated" },
    ]);
  });

  it("accepts all four valid kinds", () => {
    const content = [
      "1\t1\tsignal\tk\tp",
      "2\t2\tstale\tk\tp",
      "3\t3\tcheck\tk\tp",
      "4\t4\theartbeat\tk\tp",
    ].join("\n");
    const entries = parseWakeQueue(content);
    expect(entries.map((e) => e.kind)).toEqual(["signal", "stale", "check", "heartbeat"]);
  });

  it("drops lines with an unrecognized kind", () => {
    const entries = parseWakeQueue("1\t1\tbogus-kind\tk\tp\n");
    expect(entries).toEqual([]);
  });

  it("drops malformed lines (wrong field count)", () => {
    const entries = parseWakeQueue("1\t1\tsignal\tk\n");
    expect(entries).toEqual([]);
  });

  it("returns empty for an empty queue (normal drained state)", () => {
    expect(parseWakeQueue("")).toEqual([]);
  });
});
