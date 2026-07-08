import { describe, expect, it } from "vitest";
import { parseProjects } from "../../src/adapter/projects.js";

describe("parseProjects", () => {
  it("parses mode, description and added date", () => {
    const [entry] = parseProjects("- demo-repo [no-mistakes] - Demo repository (added 2026-06-01)\n");
    expect(entry).toEqual({
      name: "demo-repo",
      mode: "no-mistakes",
      yolo: false,
      description: "Demo repository",
      added: "2026-06-01",
    });
  });

  it("detects the +yolo flag inside the bracket", () => {
    const [entry] = parseProjects("- demo-direct [direct-PR +yolo] - Demo project (added 2026-06-02)\n");
    expect(entry?.mode).toBe("direct-PR");
    expect(entry?.yolo).toBe(true);
  });

  it("defaults mode to no-mistakes when the bracket is omitted", () => {
    const [entry] = parseProjects("- demo-repo - Demo repository (added 2026-06-01)\n");
    expect(entry?.mode).toBe("no-mistakes");
    expect(entry?.yolo).toBe(false);
  });

  it("treats an undocumented mode value as free text (reference-only)", () => {
    const [entry] = parseProjects("- demo-ref [reference-only] - Reference clone (added 2026-06-01)\n");
    expect(entry?.mode).toBe("reference-only");
  });

  it("skips lines that do not match the registry grammar", () => {
    expect(parseProjects("not a project line\n")).toEqual([]);
  });
});
