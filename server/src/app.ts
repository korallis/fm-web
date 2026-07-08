import { Hono } from "hono";
import { buildFleetSnapshot } from "./adapter/fleetState.js";

/** The Hono app factory, isolated from Bun.serve/websocket wiring so it's directly testable. */
export function createApp(fmHome: string): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, fmHome }));
  app.get("/api/fleet", (c) => c.json(buildFleetSnapshot(fmHome)));

  return app;
}
