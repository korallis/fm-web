import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { capturePaneTail, hasSession, killSession, newSession } from "../../src/tmux/tmuxClient.js";
import { readComposerState, selectSettleMs, submitText } from "../../src/tmux/submit.js";

const FIXTURE = join(import.meta.dirname, "..", "fixtures", "fake-composer.mjs");
const BUN = process.env["BUN_PATH"] ?? process.execPath;

let sessionsToClean: string[] = [];

afterEach(async () => {
  await Promise.all(sessionsToClean.map((name) => killSession(name)));
  sessionsToClean = [];
});

async function startFakeComposer(clearAfter: number): Promise<string> {
  const sessionName = `fm-web-test-submit-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  await newSession({
    sessionName,
    windowName: "main",
    cwd: "/tmp",
    command: `CLEAR_AFTER=${clearAfter} ${BUN} ${FIXTURE}`,
    width: 80,
    height: 24,
  });
  sessionsToClean.push(sessionName);
  // Give the harness a beat to install its raw-mode handler and render.
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  return sessionName;
}

describe("submitText (real tmux, fake composer harness)", () => {
  it("submits on the first Enter when the harness clears immediately", async () => {
    const target = await startFakeComposer(1);
    const verdict = await submitText(target, "hello", { retries: 5, enterSleepMs: 200 });
    expect(verdict).toBe("empty");
    const state = await readComposerState(target);
    expect(state).toBe("empty");
  });

  it("submits multiline prompts as one bracketed paste entry", async () => {
    const target = await startFakeComposer(1);
    const verdict = await submitText(target, "hello\nworld", {
      retries: 5,
      enterSleepMs: 200,
      postSubmitSettleMs: 0,
    });
    expect(verdict).toBe("empty");
    const tail = await capturePaneTail(target, 10);
    const submitted = tail?.split(/\r?\n/).filter((line) => line.startsWith("submitted:"));
    expect(submitted).toEqual(["submitted:hello\\nworld"]);
  });

  it("retries Enter (never retyping) until a swallow clears on a later attempt", async () => {
    const target = await startFakeComposer(3);
    const verdict = await submitText(target, "hello", { retries: 5, enterSleepMs: 200 });
    expect(verdict).toBe("empty");
  });

  it("reports pending when Enter is swallowed past the retry budget", async () => {
    const target = await startFakeComposer(100);
    const verdict = await submitText(target, "hello", {
      retries: 3,
      enterSleepMs: 150,
      postSubmitSettleMs: 0,
    });
    expect(verdict).toBe("pending");
  });

  it("reports send-failed against a session that does not exist", async () => {
    const verdict = await submitText("fm-web-test-submit-does-not-exist:main", "hello", {
      retries: 1,
      enterSleepMs: 50,
    });
    expect(verdict).toBe("send-failed");
  });

  it("ensureSession-adjacent: has-session correctly reports the started fake composer session", async () => {
    const target = await startFakeComposer(1);
    const sessionName = target.split(":")[0] as string;
    expect(await hasSession(sessionName)).toBe(true);
  });
});

describe("selectSettleMs", () => {
  it("gives slash commands the longer settle", () => {
    expect(selectSettleMs("/help")).toBe(1200);
  });

  it("gives codex $<skill> invocations the longer settle", () => {
    expect(selectSettleMs("$deploy", "codex")).toBe(1200);
  });

  it("normalizes codex harness commands before selecting settle", () => {
    expect(selectSettleMs("$deploy", "codex --model gpt-5")).toBe(1200);
    expect(selectSettleMs("$deploy", "/usr/local/bin/codex")).toBe(1200);
  });

  it("does not extend $ settle for non-codex harnesses", () => {
    expect(selectSettleMs("$5/month", "claude")).toBe(300);
  });

  it("uses the default settle for plain text", () => {
    expect(selectSettleMs("just some text")).toBe(300);
  });
});
