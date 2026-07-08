import { describe, expect, it } from "vitest";
import { parseSecondmates } from "../../src/adapter/secondmates.js";

describe("parseSecondmates", () => {
  it("parses id, summary, home, scope and a comma-separated project list", () => {
    const [entry] = parseSecondmates(
      "- demo-secondmate - Demo charter (home: /tmp/home; scope: demo scope; projects: repo-a, repo-b; added 2026-06-05)\n",
    );
    expect(entry).toEqual({
      id: "demo-secondmate",
      summary: "Demo charter",
      home: "/tmp/home",
      scope: "demo scope",
      projects: ["repo-a", "repo-b"],
      added: "2026-06-05",
    });
  });

  it("returns an empty projects list when the CSV is empty", () => {
    const [entry] = parseSecondmates(
      "- demo-secondmate - Demo charter (home: /tmp/home; scope: demo scope; projects: ; added 2026-06-05)\n",
    );
    expect(entry?.projects).toEqual([]);
  });

  it("returns nothing for an absent/empty file", () => {
    expect(parseSecondmates("")).toEqual([]);
  });
});
