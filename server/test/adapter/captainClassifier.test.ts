import { describe, expect, it } from "vitest";
import {
  captainRegexFromEnv,
  FM_CAPTAIN_RE_DEFAULT,
  isCaptainRelevant,
} from "../../src/adapter/captainClassifier.js";

describe("isCaptainRelevant", () => {
  it("matches each documented trigger, case-insensitively", () => {
    for (const line of [
      "done: shipped",
      "needs-decision: pick one",
      "blocked: waiting on X",
      "failed: build broke",
      "PR ready for review",
      "checks green",
      "ready in branch fm/x",
      "merged into main",
      "DONE: shouting works too",
    ]) {
      expect(isCaptainRelevant(line)).toBe(true);
    }
  });

  it("does not match an ordinary working status", () => {
    expect(isCaptainRelevant("working: still going")).toBe(false);
  });
});

describe("captainRegexFromEnv", () => {
  it("falls back to the default when FM_CAPTAIN_RE is unset", () => {
    expect(captainRegexFromEnv({}).source).toBe(FM_CAPTAIN_RE_DEFAULT.source);
  });

  it("honors an FM_CAPTAIN_RE override", () => {
    const re = captainRegexFromEnv({ FM_CAPTAIN_RE: "only-this-word" });
    expect(re.test("only-this-word")).toBe(true);
    expect(re.test("done: shipped")).toBe(false);
  });
});
