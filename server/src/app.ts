import { Hono } from "hono";
import type { GuardedActionRequest, PeekResult, TimingConstants } from "@fm-web/shared";
import { buildFleetSnapshot, readIfExists } from "./adapter/fleetState.js";
import { buildTaskDetail } from "./adapter/taskDetail.js";
import { readLockInfo } from "./adapter/lock.js";
import { isSafeTaskId, metaPath } from "./adapter/paths.js";
import { discoverHomes, resolveHomeId } from "./adapter/homes.js";
import { discoverSkills } from "./adapter/skills.js";
import type { ComposerQueue } from "./composer/queue.js";
import { crossOriginResponse, isSameOriginRequest } from "./http/origin.js";
import {
  isAdvancedDrawerMutatingScript,
  isAdvancedDrawerScript,
  recordGuardedActionDenial,
  runGuardedAction,
} from "./safety/guardedActions.js";
import { listAudit } from "./safety/audit.js";
import { runReadOnlyScript } from "./safety/scriptRunner.js";

export interface CommandDeckDeps {
  fmHome: string;
  composerQueue: ComposerQueue;
  /** Sends Ctrl-C to the app-owned session; returns false when read-only. */
  interrupt: () => Promise<boolean>;
  /** True when a live firstmate session other than our own owned one holds `state/.lock`. */
  isReadOnly: () => Promise<boolean>;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const DEFAULT_PEEK_LINES = 200;
const MAX_PEEK_LINES = 2000;

function parsePeekLines(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return DEFAULT_PEEK_LINES;
  return Math.min(value, MAX_PEEK_LINES);
}

function taskMetaExists(fmHome: string, id: string): boolean {
  return readIfExists(metaPath(fmHome, id)) !== null;
}

function extractGuardedActionRequest(body: unknown): GuardedActionRequest | null {
  if (body === null || typeof body !== "object" || !("script" in body) || !("args" in body)) return null;
  const { script, args } = body as { script: unknown; args: unknown };
  if (typeof script !== "string") return null;
  if (!Array.isArray(args) || !args.every((arg): arg is string => typeof arg === "string")) return null;
  return { script, args };
}

/** The Hono app factory, isolated from Bun.serve/websocket wiring so it's directly testable. */
export function createApp(fmHome: string, options: SnapshotOptions = {}): Hono {
  const app = new Hono();
  const commandDeck = options.commandDeck;

  const isCrewMutationReadOnly = async (home: string): Promise<boolean> => {
    if (commandDeck !== undefined && home === commandDeck.fmHome) return commandDeck.isReadOnly();
    return readLockInfo(home).alive === true;
  };

  app.get("/api/health", (c) => c.json({ ok: true, fmHome }));
  app.get("/api/homes", (c) => c.json({ commandDeckHomeId: "primary", homes: discoverHomes(fmHome) }));
  app.get("/api/fleet", async (c) => {
    const home = resolveHomeId(fmHome, c.req.query("home"));
    if (home === null) return c.json({ error: "unknown home id" }, 400);
    return c.json(await buildFleetSnapshot(home, Date.now(), options.timing, options.captainRegex));
  });
  app.get("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    if (!isSafeTaskId(id)) return c.json({ error: "invalid task id" }, 400);
    const home = resolveHomeId(fmHome, c.req.query("home"));
    if (home === null) return c.json({ error: "unknown home id" }, 400);
    const detail = await buildTaskDetail(home, id);
    if (detail === null) return c.json({ error: "task not found" }, 404);
    return c.json(detail);
  });

  // Crew peek/steer: `fm-peek.sh`/`fm-send.sh` resolve their own target from `state/<id>.meta`, so
  // these work against any crew task regardless of whether the app-owned command deck is wired.
  app.get("/api/tasks/:id/peek", async (c) => {
    const id = c.req.param("id");
    if (!isSafeTaskId(id)) return c.json({ error: "invalid task id" }, 400);
    const home = resolveHomeId(fmHome, c.req.query("home"));
    if (home === null) return c.json({ error: "unknown home id" }, 400);
    if (!taskMetaExists(home, id)) return c.json({ error: "task not found" }, 404);
    const lines = parsePeekLines(c.req.query("lines"));
    try {
      const result = await runReadOnlyScript(home, "fm-peek.sh", [id, String(lines)]);
      return c.json({ text: result.stdout } satisfies PeekResult);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 502);
    }
  });
  app.post("/api/tasks/:id/send", async (c) => {
    if (!isSameOriginRequest(c.req.raw.headers)) return crossOriginResponse();
    const id = c.req.param("id");
    if (!isSafeTaskId(id)) return c.json({ error: "invalid task id" }, 400);
    const home = resolveHomeId(fmHome, c.req.query("home"));
    if (home === null) return c.json({ error: "unknown home id" }, 400);
    if (!taskMetaExists(home, id)) return c.json({ error: "task not found" }, 404);
    const text = extractText(await c.req.json().catch(() => null));
    if (text === null) return c.json({ error: "body must be { text: string }" }, 400);
    const args = [id, text];
    if (await isCrewMutationReadOnly(home)) {
      return c.json(recordGuardedActionDenial("fm-send.sh", args, "read-only"), 409);
    }
    return c.json(await runGuardedAction(home, "fm-send.sh", args));
  });
  app.post("/api/tasks/:id/interrupt", async (c) => {
    if (!isSameOriginRequest(c.req.raw.headers)) return crossOriginResponse();
    const id = c.req.param("id");
    if (!isSafeTaskId(id)) return c.json({ error: "invalid task id" }, 400);
    const home = resolveHomeId(fmHome, c.req.query("home"));
    if (home === null) return c.json({ error: "unknown home id" }, 400);
    if (!taskMetaExists(home, id)) return c.json({ error: "task not found" }, 404);
    const args = [id, "--key", "C-c"];
    if (await isCrewMutationReadOnly(home)) {
      return c.json(recordGuardedActionDenial("fm-send.sh", args, "read-only"), 409);
    }
    return c.json(await runGuardedAction(home, "fm-send.sh", args));
  });

  if (commandDeck === undefined) {
    const notConfigured = (): Response =>
      Response.json({ error: "command deck not configured" }, { status: 503 });
    app.get("/api/skills", notConfigured);
    app.get("/api/composer/state", notConfigured);
    app.post("/api/composer/send", notConfigured);
    app.post("/api/session/interrupt", notConfigured);
    app.post("/api/advanced/run", notConfigured);
    app.get("/api/advanced/audit", notConfigured);
    return app;
  }

  app.get("/api/skills", (c) => c.json(discoverSkills(commandDeck.fmHome)));
  app.get("/api/composer/state", async (c) => c.json(await commandDeck.composerQueue.buildState()));
  app.post("/api/composer/send", async (c) => {
    if (!isSameOriginRequest(c.req.raw.headers)) return crossOriginResponse();
    const text = extractText(await c.req.json().catch(() => null));
    if (text === null) return c.json({ accepted: false, error: "body must be { text: string }" }, 400);
    const result = await commandDeck.composerQueue.enqueue(text);
    return c.json(result, result.accepted ? 200 : 409);
  });
  app.post("/api/session/interrupt", async (c) => {
    if (!isSameOriginRequest(c.req.raw.headers)) return crossOriginResponse();
    return c.json({ sent: await commandDeck.interrupt() });
  });

  // The advanced drawer: the ONLY place direct mutating-script execution is exposed, gated same
  // as every other mutating route plus a read-only-lock check (coexistence: degrade when another
  // live firstmate session holds the app-owned session's lock). `fm-review-diff.sh` is read-only
  // anytime per the safety contract, so it alone is exempt from the lock check.
  app.post("/api/advanced/run", async (c) => {
    if (!isSameOriginRequest(c.req.raw.headers)) return crossOriginResponse();
    const request = extractGuardedActionRequest(await c.req.json().catch(() => null));
    if (request === null) return c.json({ error: "body must be { script: string, args: string[] }" }, 400);
    if (!isAdvancedDrawerScript(request.script)) {
      return c.json(recordGuardedActionDenial(request.script, request.args, "not an advanced-drawer script"));
    }
    if (isAdvancedDrawerMutatingScript(request.script) && (await commandDeck.isReadOnly())) {
      return c.json(recordGuardedActionDenial(request.script, request.args, "read-only"), 409);
    }
    return c.json(await runGuardedAction(commandDeck.fmHome, request.script, request.args));
  });
  app.get("/api/advanced/audit", (c) => c.json({ entries: listAudit() }));

  return app;
}
