import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UNKNOWN_LOCK_PID, isPidAlive, parseLock, readLockInfo } from "../../src/adapter/lock.js";

describe("parseLock", () => {
  it("parses a bare pid", () => {
    expect(parseLock("15356\n")).toEqual({ pid: 15356, alive: null });
  });

  it("returns null pid for malformed content", () => {
    expect(parseLock("not-a-pid\n")).toEqual({ pid: null, alive: null });
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

describe("readLockInfo", () => {
  it("treats a missing lock file as free", () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      expect(readLockInfo(fmHome)).toEqual({ pid: null, alive: null });
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("fails closed when the lock path exists but cannot be read as a file", () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state", ".lock"), { recursive: true });
      expect(readLockInfo(fmHome)).toEqual({ pid: UNKNOWN_LOCK_PID, alive: true });
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("fails closed when an existing lock file is malformed", () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      writeFileSync(join(fmHome, "state", ".lock"), "not-a-pid\n");
      expect(readLockInfo(fmHome)).toEqual({ pid: UNKNOWN_LOCK_PID, alive: true });
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });

  it("fails closed when an existing lock file is empty", () => {
    const fmHome = mkdtempSync(join(tmpdir(), "fm-home-"));
    try {
      mkdirSync(join(fmHome, "state"), { recursive: true });
      writeFileSync(join(fmHome, "state", ".lock"), "");
      expect(readLockInfo(fmHome)).toEqual({ pid: UNKNOWN_LOCK_PID, alive: true });
    } finally {
      rmSync(fmHome, { recursive: true, force: true });
    }
  });
});
