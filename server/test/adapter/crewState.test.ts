import { describe, expect, it } from "vitest";
import { parseCrewStateOutput } from "../../src/adapter/crewState.js";

describe("parseCrewStateOutput", () => {
  it("parses the state/source/detail grammar with the middle-dot separator", () => {
    expect(parseCrewStateOutput("state: working · source: pane · harness busy")).toEqual({
      state: "working",
      source: "pane",
      detail: "harness busy",
    });
  });

  it("parses the unknown/none case (no metadata)", () => {
    expect(parseCrewStateOutput("state: unknown · source: none · no metadata for task-x")).toEqual({
      state: "unknown",
      source: "none",
      detail: "no metadata for task-x",
    });
  });

  it("falls back to unknown/none for a line that does not match the grammar at all", () => {
    expect(parseCrewStateOutput("garbage output")).toEqual({
      state: "unknown",
      source: "none",
      detail: "garbage output",
    });
  });

  it("falls back to unknown/none for unrecognized state/source tokens", () => {
    expect(parseCrewStateOutput("state: sleeping · source: dream · napping")).toEqual({
      state: "unknown",
      source: "none",
      detail: "napping",
    });
  });
});
