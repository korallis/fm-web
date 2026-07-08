import { describe, expect, it } from "vitest";
import { DEFAULT_TIMING, loadTimingFromEnv } from "../../src/adapter/timing.js";

describe("DEFAULT_TIMING", () => {
  it("matches firstmate's documented defaults exactly", () => {
    expect(DEFAULT_TIMING).toEqual({
      pollSeconds: 15,
      guardGraceSeconds: 300,
      heartbeatBaseSeconds: 600,
      heartbeatMaxSeconds: 7200,
      staleEscalateSeconds: 240,
      checkIntervalSeconds: 300,
    });
  });
});

describe("loadTimingFromEnv", () => {
  it("falls back to defaults when no env vars are set", () => {
    expect(loadTimingFromEnv({})).toEqual(DEFAULT_TIMING);
  });

  it("honors overrides and ignores unrelated env vars", () => {
    const timing = loadTimingFromEnv({ FM_POLL: "30", FM_GUARD_GRACE: "600", PATH: "/usr/bin" });
    expect(timing.pollSeconds).toBe(30);
    expect(timing.guardGraceSeconds).toBe(600);
    expect(timing.heartbeatBaseSeconds).toBe(DEFAULT_TIMING.heartbeatBaseSeconds);
  });

  it("falls back to the default when an override is not a number", () => {
    expect(loadTimingFromEnv({ FM_POLL: "not-a-number" }).pollSeconds).toBe(DEFAULT_TIMING.pollSeconds);
  });

  it("falls back to defaults when overrides are blank", () => {
    const timing = loadTimingFromEnv({ FM_GUARD_GRACE: "", FM_STALE_ESCALATE_SECS: "   " });
    expect(timing.guardGraceSeconds).toBe(DEFAULT_TIMING.guardGraceSeconds);
    expect(timing.staleEscalateSeconds).toBe(DEFAULT_TIMING.staleEscalateSeconds);
  });
});
