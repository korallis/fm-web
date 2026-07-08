import { describe, expect, it } from "vitest";
import { parseMeta } from "../../src/adapter/meta.js";

describe("parseMeta", () => {
  it("parses all known fields from a ship task with herdr backend", () => {
    const meta = parseMeta(
      [
        "window=default:w1:p3",
        "worktree=/tmp/fixture-home/projects/demo-repo",
        "project=/tmp/fixture-home/projects/demo-repo",
        "harness=claude",
        "kind=ship",
        "mode=no-mistakes",
        "yolo=off",
        "model=claude-sonnet-5",
        "backend=herdr",
        "herdr_session=default",
      ].join("\n"),
    );

    expect(meta.kind).toBe("ship");
    expect(meta.harness).toBe("claude");
    expect(meta.backend).toBe("herdr");
    expect(meta.worktree).toBe("/tmp/fixture-home/projects/demo-repo");
    expect(meta.extra["herdr_session"]).toBe("default");
  });

  it("defaults kind to ship when absent", () => {
    const meta = parseMeta("worktree=/tmp/x\n");
    expect(meta.kind).toBe("ship");
  });

  it("defaults kind to ship when the value is not a known task kind", () => {
    const meta = parseMeta("kind=bogus\n");
    expect(meta.kind).toBe("ship");
  });

  it("takes the LAST occurrence of a repeated key (append-style updates)", () => {
    const meta = parseMeta(["pr=", "pr=https://github.com/example/repo/pull/1"].join("\n"));
    expect(meta.pr).toBe("https://github.com/example/repo/pull/1");
  });

  it("puts unknown keys into extra without dropping them", () => {
    const meta = parseMeta("orca_worktree_id=abc123\nsome_future_key=zzz\n");
    expect(meta.orca_worktree_id).toBe("abc123");
    expect(meta.extra["some_future_key"]).toBe("zzz");
  });

  it("ignores blank lines and lines without an =", () => {
    const meta = parseMeta("\nkind=scout\n\nnot-a-kv-line\n");
    expect(meta.kind).toBe("scout");
  });
});
