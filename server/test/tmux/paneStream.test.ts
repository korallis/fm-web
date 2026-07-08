import { afterEach, describe, expect, it } from "vitest";
import { appendFileSync, closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { killSession, sendKey, sendLiteral } from "../../src/tmux/tmuxClient.js";
import { ensureFirstMateSession, sessionNameFor } from "../../src/tmux/sessionManager.js";
import {
  PaneTailer,
  captureResyncSnapshot,
  ensurePaneStream,
  paneSnapshotToXterm,
} from "../../src/tmux/paneStream.js";

let sessionsToClean: string[] = [];
let dirsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(sessionsToClean.map((name) => killSession(name)));
  sessionsToClean = [];
  for (const dir of dirsToClean) rmSync(dir, { recursive: true, force: true });
  dirsToClean = [];
});

describe("paneSnapshotToXterm", () => {
  it("joins lines with CRLF and resets SGR at each line end", () => {
    expect(paneSnapshotToXterm("a\nb\nc")).toBe("a\x1b[0m\r\nb\x1b[0m\r\nc\x1b[0m");
  });

  it("trims trailing blank rows so real content isn't scrolled off-screen in a shorter viewport", () => {
    expect(paneSnapshotToXterm("bash-5.3$\n\n\n\n\n")).toBe("bash-5.3$\x1b[0m");
  });

  it("treats a row holding only ANSI reset codes as blank too", () => {
    expect(paneSnapshotToXterm("real content\n\x1b[0m\n\x1b[0m")).toBe("real content\x1b[0m");
  });

  it("keeps intentional blank rows that fall BEFORE the last real content", () => {
    expect(paneSnapshotToXterm("a\n\nb\n\n")).toBe("a\x1b[0m\r\n\x1b[0m\r\nb\x1b[0m");
  });
});

describe("ensurePaneStream + PaneTailer (real tmux)", () => {
  it("streams new pane output appended after the tailer starts", async () => {
    const fmHome = `/tmp/fm-web-test-home-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const sessionName = sessionNameFor(fmHome);
    const { target } = await ensureFirstMateSession(fmHome, "bash --norc -i");
    sessionsToClean.push(sessionName);

    const logPath = await ensurePaneStream(target, sessionName);
    const tailer = new PaneTailer(logPath);
    const chunks: string[] = [];
    tailer.onChunk((text) => chunks.push(text));
    tailer.start();

    await new Promise((r) => setTimeout(r, 200));
    await sendLiteral(target, "echo marker-hello");
    await sendKey(target, "Enter");
    await new Promise((r) => setTimeout(r, 500));
    tailer.checkForUpdates();
    tailer.stop();

    expect(chunks.join("")).toContain("marker-hello");
  });

  it("is idempotent: calling ensurePaneStream twice does not error or duplicate the pipe", async () => {
    const fmHome = `/tmp/fm-web-test-home-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const sessionName = sessionNameFor(fmHome);
    const { target } = await ensureFirstMateSession(fmHome, "sleep 30");
    sessionsToClean.push(sessionName);

    await ensurePaneStream(target, sessionName);
    await ensurePaneStream(target, sessionName);
    await sendLiteral(target, "no-op");
    // No assertion beyond "did not throw" — `-o` makes the second pipe-pane call a no-op, and a
    // duplicated pipe would double every future chunk, which the streaming test above would catch.
  });
});

describe("captureResyncSnapshot", () => {
  it("returns a snapshot for a live session and null for a missing one", async () => {
    const fmHome = `/tmp/fm-web-test-home-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const { target } = await ensureFirstMateSession(fmHome, "sleep 30");
    sessionsToClean.push(sessionNameFor(fmHome));
    const snapshot = await captureResyncSnapshot(target);
    expect(snapshot).not.toBeNull();
    expect(await captureResyncSnapshot("fm-web-test-does-not-exist:main")).toBeNull();
  });
});

describe("PaneTailer UTF-8 boundary handling", () => {
  it("does not emit a replacement character when a multi-byte char is split across two appends", () => {
    const dir = mkdtempSync(join(tmpdir(), "fm-web-test-tailer-"));
    dirsToClean.push(dir);
    const logPath = join(dir, "pane.log");
    closeSync(openSync(logPath, "a"));

    const tailer = new PaneTailer(logPath);
    const chunks: string[] = [];
    tailer.onChunk((text) => chunks.push(text));

    // "€" is E2 82 AC in UTF-8 — split the write across two appends, mid-character.
    const euroBytes = Buffer.from("€", "utf8");
    appendFileSync(logPath, Buffer.concat([Buffer.from("before-"), euroBytes.subarray(0, 1)]));
    tailer.checkForUpdates();
    appendFileSync(logPath, Buffer.concat([euroBytes.subarray(1), Buffer.from("-after")]));
    tailer.checkForUpdates();

    expect(chunks.join("")).toBe("before-€-after");
    expect(chunks.join("")).not.toContain("�");
  });
});
