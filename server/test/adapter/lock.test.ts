import { describe, expect, it } from "vitest";
import { isPidAlive, parseLock } from "../../src/adapter/lock.js";

describe("parseLock", () => {
  it("parses a bare pid", () => {
    expect(parseLock("15356\n")).toEqual({ pid: 15356 });
  });

  it("returns null pid for malformed content", () => {
    expect(parseLock("not-a-pid\n")).toEqual({ pid: null });
  });
});

describe("isPidAlive", () => {
  it("is true for the current process", () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  it("is false for a pid that almost certainly does not exist", () => {
    expect(isPidAlive(999_999)).toBe(false);
  });
});
