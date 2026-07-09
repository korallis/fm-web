import { afterEach, describe, expect, it } from "vitest";
import { clearAuditForTests, listAudit, recordAudit } from "../../src/safety/audit.js";

afterEach(() => {
  clearAuditForTests();
});

describe("audit log", () => {
  it("starts empty", () => {
    expect(listAudit()).toEqual([]);
  });

  it("records an entry with a stable, incrementing id", () => {
    const first = recordAudit(
      { script: "fm-teardown.sh", args: ["task-a1"], ok: true, summary: "done" },
      1000,
    );
    const second = recordAudit(
      { script: "fm-promote.sh", args: ["task-a1"], ok: false, summary: "err" },
      2000,
    );
    expect(first.id).not.toBe(second.id);
    expect(first.atMs).toBe(1000);
    expect(second.atMs).toBe(2000);
  });

  it("returns entries newest first", () => {
    recordAudit({ script: "a.sh", args: [], ok: true, summary: "a" }, 1);
    recordAudit({ script: "b.sh", args: [], ok: true, summary: "b" }, 2);
    const entries = listAudit();
    expect(entries.map((e) => e.script)).toEqual(["b.sh", "a.sh"]);
  });

  it("caps at 200 entries, dropping the oldest", () => {
    for (let i = 0; i < 205; i++) {
      recordAudit({ script: `s${i}.sh`, args: [], ok: true, summary: String(i) }, i);
    }
    const entries = listAudit();
    expect(entries).toHaveLength(200);
    expect(entries[0]?.summary).toBe("204");
    expect(entries[entries.length - 1]?.summary).toBe("5");
  });

  it("copies args so later mutation of the input array doesn't affect the stored entry", () => {
    const args = ["task-a1"];
    recordAudit({ script: "fm-teardown.sh", args, ok: true, summary: "done" });
    args.push("--force");
    expect(listAudit()[0]?.args).toEqual(["task-a1"]);
  });
});
