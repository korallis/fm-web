import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ComposerQueueDeps } from "../src/composer/queue.js";
import { ComposerQueue } from "../src/composer/queue.js";
import { createApp } from "../src/app.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "fm-home");
const SKILLS_FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "skills-home");

function makeDeps(overrides: Partial<ComposerQueueDeps> = {}): ComposerQueueDeps {
  return {
    submit: vi.fn().mockResolvedValue("empty"),
    isBusy: vi.fn().mockResolvedValue(false),
    isReadOnly: vi.fn().mockResolvedValue(false),
    getLock: vi.fn().mockResolvedValue({ pid: null, alive: null }),
    isSessionReady: vi.fn().mockResolvedValue(true),
    busyPollMs: 5,
    ...overrides,
  };
}

describe("createApp without a command deck", () => {
  it("returns 503 for command deck routes", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/composer/state");
    expect(res.status).toBe(503);
  });
});

describe("createApp with a command deck", () => {
  it("GET /api/skills returns discovered skills for the configured fmHome", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: { fmHome: SKILLS_FIXTURE_HOME, composerQueue, interrupt: vi.fn().mockResolvedValue(true) },
    });
    const res = await app.request("/api/skills");
    const body = (await res.json()) as { id: string }[];
    expect(body.some((s) => s.id === "stow")).toBe(true);
  });

  it("GET /api/composer/state reflects the queue's composed state", async () => {
    const composerQueue = new ComposerQueue(makeDeps({ isBusy: vi.fn().mockResolvedValue(true) }));
    const app = createApp(FIXTURE_HOME, {
      commandDeck: { fmHome: FIXTURE_HOME, composerQueue, interrupt: vi.fn().mockResolvedValue(true) },
    });
    const res = await app.request("/api/composer/state");
    const body = (await res.json()) as { busy: boolean };
    expect(body.busy).toBe(true);
  });

  it("POST /api/composer/send with a non-string text is a 400", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: { fmHome: FIXTURE_HOME, composerQueue, interrupt: vi.fn().mockResolvedValue(true) },
    });
    const res = await app.request("/api/composer/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: 5 }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/composer/send with valid text enqueues and returns 200", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: { fmHome: FIXTURE_HOME, composerQueue, interrupt: vi.fn().mockResolvedValue(true) },
    });
    const res = await app.request("/api/composer/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accepted: boolean };
    expect(body.accepted).toBe(true);
  });

  it("POST /api/composer/send returns 409 when rejected (e.g. read-only)", async () => {
    const composerQueue = new ComposerQueue(makeDeps({ isReadOnly: vi.fn().mockResolvedValue(true) }));
    const app = createApp(FIXTURE_HOME, {
      commandDeck: { fmHome: FIXTURE_HOME, composerQueue, interrupt: vi.fn().mockResolvedValue(true) },
    });
    const res = await app.request("/api/composer/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(res.status).toBe(409);
  });

  it("POST /api/session/interrupt calls through to the interrupt dependency", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const interrupt = vi.fn().mockResolvedValue(true);
    const app = createApp(FIXTURE_HOME, {
      commandDeck: { fmHome: FIXTURE_HOME, composerQueue, interrupt },
    });
    const res = await app.request("/api/session/interrupt", { method: "POST" });
    const body = (await res.json()) as { sent: boolean };
    expect(body.sent).toBe(true);
    expect(interrupt).toHaveBeenCalled();
  });
});
