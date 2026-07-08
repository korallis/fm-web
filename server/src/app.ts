import { Hono } from "hono";
import type { TimingConstants } from "@fm-web/shared";
import { buildFleetSnapshot } from "./adapter/fleetState.js";

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

  return app;
}
