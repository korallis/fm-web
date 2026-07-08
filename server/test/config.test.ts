import { describe, expect, it } from "vitest";
import { DEFAULT_SERVER_PORT, loadHarnessCommandFromEnv, loadPortFromEnv } from "../src/config.js";

describe("loadPortFromEnv", () => {
  it("falls back to the default when PORT is unset or blank", () => {
    expect(loadPortFromEnv({})).toBe(DEFAULT_SERVER_PORT);
    expect(loadPortFromEnv({ PORT: "" })).toBe(DEFAULT_SERVER_PORT);
    expect(loadPortFromEnv({ PORT: "   " })).toBe(DEFAULT_SERVER_PORT);
  });

  it("uses a valid configured PORT", () => {
    expect(loadPortFromEnv({ PORT: " 4871 " })).toBe(4871);
  });

  it("falls back to the default when PORT is invalid", () => {
    expect(loadPortFromEnv({ PORT: "not-a-number" })).toBe(DEFAULT_SERVER_PORT);
    expect(loadPortFromEnv({ PORT: "0" })).toBe(DEFAULT_SERVER_PORT);
    expect(loadPortFromEnv({ PORT: "70000" })).toBe(DEFAULT_SERVER_PORT);
  });
});

describe("loadHarnessCommandFromEnv", () => {
  it("defaults to claude when unset or blank", () => {
    expect(loadHarnessCommandFromEnv({})).toBe("claude");
    expect(loadHarnessCommandFromEnv({ FM_DECK_HARNESS_CMD: "   " })).toBe("claude");
  });

  it("uses a configured harness command", () => {
    expect(loadHarnessCommandFromEnv({ FM_DECK_HARNESS_CMD: " codex " })).toBe("codex");
  });
});
