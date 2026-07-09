import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { hasSession, killSession } from "../../src/tmux/tmuxClient.js";
import {
  ensureFirstMateSession,
  isLockHeldByOwnSession,
  isPidDescendantOf,
  isSessionBusy,
  sessionNameFor,
  sessionTargetFor,
} from "../../src/tmux/sessionManager.js";

let sessionsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(sessionsToClean.map((name) => killSession(name)));
  sessionsToClean = [];
});

function fakeFmHome(): string {
  return `/tmp/fm-web-test-home-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe("sessionNameFor / sessionTargetFor", () => {
  it("is deterministic for the same fmHome", () => {
    const home = "/Users/captain/firstmate";
    expect(sessionNameFor(home)).toBe(sessionNameFor(home));
    expect(sessionTargetFor(home)).toBe(`${sessionNameFor(home)}:main`);
  });

  it("differs across distinct fmHome paths", () => {
    expect(sessionNameFor("/a/firstmate")).not.toBe(sessionNameFor("/b/firstmate"));
  });

  it("is a valid tmux session name (no path separators)", () => {
    expect(sessionNameFor("/Users/captain/firstmate")).not.toMatch(/[/\\]/);
  });
});

describe("ensureFirstMateSession", () => {
  it("creates a session on first call and reuses it (never recreating) on the next", async () => {
    const fmHome = fakeFmHome();
    const first = await ensureFirstMateSession(fmHome, "sleep 30");
    sessionsToClean.push(sessionNameFor(fmHome));
    expect(first.created).toBe(true);
    expect(await hasSession(sessionNameFor(fmHome))).toBe(true);

    const second = await ensureFirstMateSession(fmHome, "sleep 30");
    expect(second.created).toBe(false);
    expect(second.target).toBe(first.target);
  });
});

describe("isSessionBusy", () => {
  it("detects a busy footer in the pane tail", async () => {
    const fmHome = fakeFmHome();
    const { target } = await ensureFirstMateSession(fmHome, "bash -c 'echo \"esc to interrupt\"; sleep 30'");
    sessionsToClean.push(sessionNameFor(fmHome));
    await new Promise((r) => setTimeout(r, 300));
    expect(await isSessionBusy(target)).toBe(true);
  });

  it("reports idle when no busy footer is present", async () => {
    const fmHome = fakeFmHome();
    const { target } = await ensureFirstMateSession(fmHome, "sleep 30");
    sessionsToClean.push(sessionNameFor(fmHome));
    await new Promise((r) => setTimeout(r, 200));
    expect(await isSessionBusy(target)).toBe(false);
  });
});

describe("isPidDescendantOf", () => {
  it("is true when pid IS the ancestor (depth 0)", () => {
    expect(isPidDescendantOf(process.pid, process.pid)).toBe(true);
  });

  it("is true for a direct child process", async () => {
    const child = execFile("sleep", ["5"]);
    try {
      await new Promise((r) => setTimeout(r, 100));
      expect(isPidDescendantOf(child.pid as number, process.pid)).toBe(true);
    } finally {
      child.kill();
    }
  });

  it("is false for an unrelated live process", () => {
    // pid 1 (init/launchd) is never a descendant of our test process.
    expect(isPidDescendantOf(1, process.pid)).toBe(false);
  });
});

describe("isLockHeldByOwnSession", () => {
  it("is true when the lock pid IS the session's own pane pid", async () => {
    const fmHome = fakeFmHome();
    const { target } = await ensureFirstMateSession(fmHome, "sleep 30");
    sessionsToClean.push(sessionNameFor(fmHome));
    const paneList = await new Promise<string>((resolvePromise) => {
      execFile("tmux", ["list-panes", "-t", target, "-F", "#{pane_pid}"], (_err, stdout) =>
        resolvePromise(stdout.trim()),
      );
    });
    const ownPid = Number(paneList);
    expect(await isLockHeldByOwnSession(target, ownPid)).toBe(true);
  });

  it("is false for a live pid unrelated to our session (e.g. our own test process)", async () => {
    const fmHome = fakeFmHome();
    const { target } = await ensureFirstMateSession(fmHome, "sleep 30");
    sessionsToClean.push(sessionNameFor(fmHome));
    expect(await isLockHeldByOwnSession(target, process.pid)).toBe(false);
  });
});
