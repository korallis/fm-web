import { Hono } from "hono";
import type { TimingConstants } from "@fm-web/shared";
import { buildFleetSnapshot } from "./adapter/fleetState.js";
import { buildTaskDetail } from "./adapter/taskDetail.js";

export interface SnapshotOptions {
  timing?: TimingConstants;
  captainRegex?: RegExp;
}

/** The Hono app factory, isolated from Bun.serve/websocket wiring so it's directly testable. */
export function createApp(fmHome: string, options: SnapshotOptions = {}): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, fmHome }));
  app.get("/api/fleet", async (c) =>
    c.json(await buildFleetSnapshot(fmHome, Date.now(), options.timing, options.captainRegex)),
  );
  app.get("/api/tasks/:id", async (c) => {
    const detail = await buildTaskDetail(fmHome, c.req.param("id"));
    if (detail === null) return c.json({ error: "task not found" }, 404);
    return c.json(detail);
  });

  return app;
}
