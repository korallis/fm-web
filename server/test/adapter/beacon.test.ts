import { describe, expect, it } from "vitest";
import { beaconAgeSeconds, isBeaconFresh } from "../../src/adapter/beacon.js";

describe("beaconAgeSeconds", () => {
  it("computes seconds elapsed since the beacon mtime", () => {
    const mtime = 1_000_000;
    const now = mtime + 45_000;
    expect(beaconAgeSeconds(mtime, now)).toBe(45);
  });

  it("never goes negative", () => {
    expect(beaconAgeSeconds(1000, 500)).toBe(0);
  });
});

describe("isBeaconFresh", () => {
  it("is fresh under the guard grace window (default 300s)", () => {
    expect(isBeaconFresh(299, 300)).toBe(true);
  });

  it("is stale at or past the guard grace window", () => {
    expect(isBeaconFresh(300, 300)).toBe(false);
    expect(isBeaconFresh(301, 300)).toBe(false);
  });
});
