import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposerQueueDeps } from "../src/composer/queue.js";
import { ComposerQueue } from "../src/composer/queue.js";
import type { CommandDeckDeps } from "../src/app.js";
import { createApp } from "../src/app.js";
import { clearAuditForTests, listAudit } from "../src/safety/audit.js";

const FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "fm-home");
const SKILLS_FIXTURE_HOME = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "skills-home");
const TEMP_HOMES: string[] = [];

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

function makeCommandDeck(overrides: Partial<CommandDeckDeps> = {}): CommandDeckDeps {
  return {
    fmHome: FIXTURE_HOME,
    composerQueue: new ComposerQueue(makeDeps()),
    interrupt: vi.fn().mockResolvedValue(true),
    isReadOnly: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeLockedFixtureHome(): string {
  const parent = mkdtempSync(join(tmpdir(), "fm-web-app-"));
  const fmHome = join(parent, "fm-home");
  cpSync(FIXTURE_HOME, fmHome, { recursive: true });
  writeFileSync(join(fmHome, "state", ".lock"), "not-a-pid\n");
  TEMP_HOMES.push(parent);
  return fmHome;
}

function makeUnlockedFixtureHome(): string {
  const parent = mkdtempSync(join(tmpdir(), "fm-web-app-"));
  const fmHome = join(parent, "fm-home");
  cpSync(FIXTURE_HOME, fmHome, { recursive: true });
  rmSync(join(fmHome, "state", ".lock"), { force: true });
  TEMP_HOMES.push(parent);
  return fmHome;
}

afterEach(() => {
  clearAuditForTests();
  for (const path of TEMP_HOMES.splice(0)) rmSync(path, { recursive: true, force: true });
});

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
      commandDeck: makeCommandDeck({ fmHome: SKILLS_FIXTURE_HOME, composerQueue }),
    });
    const res = await app.request("/api/skills");
    const body = (await res.json()) as { id: string }[];
    expect(body.some((s) => s.id === "stow")).toBe(true);
  });

  it("GET /api/composer/state reflects the queue's composed state", async () => {
    const composerQueue = new ComposerQueue(makeDeps({ isBusy: vi.fn().mockResolvedValue(true) }));
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue }),
    });
    const res = await app.request("/api/composer/state");
    const body = (await res.json()) as { busy: boolean };
    expect(body.busy).toBe(true);
  });

  it("POST /api/composer/send with a non-string text is a 400", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue }),
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
      commandDeck: makeCommandDeck({ composerQueue }),
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

  it("POST /api/composer/send allows a present same-origin Origin header", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue }),
    });
    const res = await app.request("/api/composer/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "127.0.0.1:4173",
        origin: "http://127.0.0.1:4173",
      },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(res.status).toBe(200);
  });

  it("POST /api/composer/send rejects a cross-origin Origin header", async () => {
    const deps = makeDeps();
    const composerQueue = new ComposerQueue(deps);
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue }),
    });
    const res = await app.request("/api/composer/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "127.0.0.1:4173",
        origin: "http://evil.example",
      },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(res.status).toBe(403);
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it("POST /api/composer/send returns 409 when rejected (e.g. read-only)", async () => {
    const composerQueue = new ComposerQueue(makeDeps({ isReadOnly: vi.fn().mockResolvedValue(true) }));
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue }),
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
      commandDeck: makeCommandDeck({ composerQueue, interrupt }),
    });
    const res = await app.request("/api/session/interrupt", { method: "POST" });
    const body = (await res.json()) as { sent: boolean };
    expect(body.sent).toBe(true);
    expect(interrupt).toHaveBeenCalled();
  });
});

describe("GET /api/tasks/:id/peek - works without a configured command deck", () => {
  it("returns the read-only fm-peek.sh output", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/tasks/task-a1/peek");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string };
    expect(body.text).toContain("stub peek output for task-a1");
  });

  it("rejects an unsafe task id", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/tasks/..%2Fescape/peek");
    expect(res.status).toBe(400);
  });

  it("rejects a safe selector that has no task meta record", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/tasks/backend-selector/peek");
    expect(res.status).toBe(404);
  });

  it("clamps a non-numeric lines query to the default", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/tasks/task-a1/peek?lines=not-a-number");
    expect(res.status).toBe(200);
  });
});

describe("POST /api/tasks/:id/send - crew steer, works without a configured command deck", () => {
  it("runs fm-send.sh against the resolved task target", async () => {
    const app = createApp(makeUnlockedFixtureHome());
    const res = await app.request("/api/tasks/task-a1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "please continue" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; stdout: string };
    expect(body.ok).toBe(true);
    expect(body.stdout).toContain("stub sent to task-a1: please continue");
  });

  it("rejects an unsafe task id", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/tasks/..%2Fescape/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hi" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a safe selector that has no task meta record", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/tasks/backend-selector/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hi" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a cross-origin request", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/tasks/task-a1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "127.0.0.1:4173",
        origin: "http://evil.example",
      },
      body: JSON.stringify({ text: "hi" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns an audited read-only denial when a lock is held without a command deck", async () => {
    const app = createApp(makeLockedFixtureHome());
    const res = await app.request("/api/tasks/task-a1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "please continue" }),
    });
    expect(res.status).toBe(409);
    expect(listAudit()[0]).toMatchObject({ script: "fm-send.sh", ok: false, summary: "read-only" });
  });

  it("returns an audited read-only denial when the command deck is read-only", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue, isReadOnly: vi.fn().mockResolvedValue(true) }),
    });
    const res = await app.request("/api/tasks/task-a1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "please continue" }),
    });
    expect(res.status).toBe(409);
    expect(listAudit()[0]).toMatchObject({ script: "fm-send.sh", ok: false, summary: "read-only" });
  });
});

describe("POST /api/tasks/:id/interrupt - crew unstick ladder", () => {
  it("sends the C-c special key via fm-send.sh", async () => {
    const app = createApp(makeUnlockedFixtureHome());
    const res = await app.request("/api/tasks/task-a1/interrupt", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; stdout: string };
    expect(body.ok).toBe(true);
    expect(body.stdout).toContain("stub sent key C-c to task-a1");
  });

  it("rejects a safe selector that has no task meta record", async () => {
    const app = createApp(FIXTURE_HOME);
    const res = await app.request("/api/tasks/backend-selector/interrupt", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns an audited read-only denial when the command deck is read-only", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue, isReadOnly: vi.fn().mockResolvedValue(true) }),
    });
    const res = await app.request("/api/tasks/task-a1/interrupt", { method: "POST" });
    expect(res.status).toBe(409);
    expect(listAudit()[0]).toMatchObject({
      script: "fm-send.sh",
      args: ["task-a1", "--key", "C-c"],
      ok: false,
      summary: "read-only",
    });
  });
});

describe("advanced drawer routes", () => {
  it("return 503 without a configured command deck", async () => {
    const app = createApp(FIXTURE_HOME);
    expect((await app.request("/api/advanced/run", { method: "POST" })).status).toBe(503);
    expect((await app.request("/api/advanced/audit")).status).toBe(503);
  });

  it("POST /api/advanced/run executes an advanced-drawer mutating script", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, { commandDeck: makeCommandDeck({ composerQueue }) });
    const res = await app.request("/api/advanced/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: "fm-promote.sh", args: ["task-a1"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; stdout: string };
    expect(body.ok).toBe(true);
    expect(body.stdout).toContain("stub promoted task-a1");
  });

  it("POST /api/advanced/run refuses scripts outside the advanced drawer scope", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, { commandDeck: makeCommandDeck({ composerQueue }) });
    const res = await app.request("/api/advanced/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: "fm-send.sh", args: ["task-a1", "hi"] }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/not an advanced-drawer script/);
  });

  it("POST /api/advanced/run refuses fm-brief.sh even though it is mutating-allowlisted", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, { commandDeck: makeCommandDeck({ composerQueue }) });
    const res = await app.request("/api/advanced/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: "fm-brief.sh", args: ["task-a1"] }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/not an advanced-drawer script/);
  });

  it("POST /api/advanced/run refuses fm-watch-arm.sh even though it is mutating-allowlisted", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, { commandDeck: makeCommandDeck({ composerQueue }) });
    const res = await app.request("/api/advanced/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: "fm-watch-arm.sh", args: [] }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/not an advanced-drawer script/);
  });

  it("POST /api/advanced/run rejects argv outside the drawer schema", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, { commandDeck: makeCommandDeck({ composerQueue }) });
    const res = await app.request("/api/advanced/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: "fm-promote.sh", args: ["task-a1", "--force"] }),
    });
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/invalid arguments/);
  });

  it("POST /api/advanced/run degrades to read-only when another session holds the lock", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue, isReadOnly: vi.fn().mockResolvedValue(true) }),
    });
    const res = await app.request("/api/advanced/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: "fm-promote.sh", args: ["task-a1"] }),
    });
    expect(res.status).toBe(409);
    const auditRes = await app.request("/api/advanced/audit");
    const audit = (await auditRes.json()) as { entries: { script: string; ok: boolean; summary: string }[] };
    expect(audit.entries[0]).toMatchObject({
      script: "fm-promote.sh",
      ok: false,
      summary: "read-only",
    });
  });

  it("POST /api/advanced/run does not degrade fm-review-diff.sh - read-only anytime per the safety contract", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, {
      commandDeck: makeCommandDeck({ composerQueue, isReadOnly: vi.fn().mockResolvedValue(true) }),
    });
    const res = await app.request("/api/advanced/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: "fm-review-diff.sh", args: ["task-a1"] }),
    });
    expect(res.status).toBe(200);
  });

  it("POST /api/advanced/run rejects a cross-origin request", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, { commandDeck: makeCommandDeck({ composerQueue }) });
    const res = await app.request("/api/advanced/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "127.0.0.1:4173",
        origin: "http://evil.example",
      },
      body: JSON.stringify({ script: "fm-promote.sh", args: ["task-a1"] }),
    });
    expect(res.status).toBe(403);
  });

  it("GET /api/advanced/audit reflects a prior run", async () => {
    const composerQueue = new ComposerQueue(makeDeps());
    const app = createApp(FIXTURE_HOME, { commandDeck: makeCommandDeck({ composerQueue }) });
    await app.request("/api/advanced/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ script: "fm-promote.sh", args: ["task-a1"] }),
    });
    const res = await app.request("/api/advanced/audit");
    const body = (await res.json()) as { entries: { script: string }[] };
    expect(body.entries[0]?.script).toBe("fm-promote.sh");
  });
});
