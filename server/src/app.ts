import { Hono } from "hono";
import type { TimingConstants } from "@fm-web/shared";
import { buildFleetSnapshot } from "./adapter/fleetState.js";
import { buildTaskDetail } from "./adapter/taskDetail.js";
import { isSafeTaskId } from "./adapter/paths.js";
import { discoverSkills } from "./adapter/skills.js";
import type { ComposerQueue } from "./composer/queue.js";

export interface CommandDeckDeps {
  fmHome: string;
  composerQueue: ComposerQueue;
  /** Sends Ctrl-C to the app-owned session; returns false when read-only. */
  interrupt: () => Promise<boolean>;
}

export interface SnapshotOptions {
  timing?: TimingConstants;
  captainRegex?: RegExp;
  commandDeck?: CommandDeckDeps;
}

function extractText(body: unknown): string | null {
  if (body === null || typeof body !== "object" || !("text" in body)) return null;
  const text = (body as { text: unknown }).text;
  return typeof text === "string" ? text : null;
}

/** The Hono app factory, isolated from Bun.serve/websocket wiring so it's directly testable. */
export function createApp(fmHome: string, options: SnapshotOptions = {}): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, fmHome }));
  app.get("/api/fleet", async (c) =>
    c.json(await buildFleetSnapshot(fmHome, Date.now(), options.timing, options.captainRegex)),
  );
  app.get("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    if (!isSafeTaskId(id)) return c.json({ error: "invalid task id" }, 400);
    const detail = await buildTaskDetail(fmHome, id);
    if (detail === null) return c.json({ error: "task not found" }, 404);
    return c.json(detail);
  });

  const commandDeck = options.commandDeck;
  if (commandDeck === undefined) {
    const notConfigured = (): Response =>
      Response.json({ error: "command deck not configured" }, { status: 503 });
    app.get("/api/skills", notConfigured);
    app.get("/api/composer/state", notConfigured);
    app.post("/api/composer/send", notConfigured);
    app.post("/api/session/interrupt", notConfigured);
    return app;
  }

  app.get("/api/skills", (c) => c.json(discoverSkills(commandDeck.fmHome)));
  app.get("/api/composer/state", async (c) => c.json(await commandDeck.composerQueue.buildState()));
  app.post("/api/composer/send", async (c) => {
    const text = extractText(await c.req.json().catch(() => null));
    if (text === null) return c.json({ accepted: false, error: "body must be { text: string }" }, 400);
    const result = await commandDeck.composerQueue.enqueue(text);
    return c.json(result, result.accepted ? 200 : 409);
  });
  app.post("/api/session/interrupt", async (c) => c.json({ sent: await commandDeck.interrupt() }));

  return app;
}
