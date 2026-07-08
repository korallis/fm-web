import { createBunWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { createApp } from "./app.js";
import { buildFleetSnapshot } from "./adapter/fleetState.js";
import { watchFmHome } from "./eventBus/watcher.js";

const fmHome = process.env["FM_HOME"];
if (fmHome === undefined || fmHome === "") {
  throw new Error("FM_HOME must be set to a firstmate home directory");
}

const { upgradeWebSocket, websocket } = createBunWebSocket();
const app = createApp(fmHome);
const clients = new Set<WSContext>();

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen: (_evt, ws) => {
      clients.add(ws);
      ws.send(JSON.stringify(buildFleetSnapshot(fmHome)));
    },
    onClose: (_evt, ws) => {
      clients.delete(ws);
    },
  })),
);

const broadcastSnapshot = (): void => {
  const snapshot = JSON.stringify(buildFleetSnapshot(fmHome));
  for (const client of clients) client.send(snapshot);
};

watchFmHome(fmHome, broadcastSnapshot);

const port = Number(process.env["PORT"] ?? 4870);

Bun.serve({
  hostname: "127.0.0.1",
  port,
  // Hono's Bun websocket adapter reads the raw Bun `Server` back off `c.env.server`.
  fetch: (req, server) => app.fetch(req, { server }),
  websocket,
});

console.log(`FM Deck server listening on http://127.0.0.1:${port} (FM_HOME=${fmHome})`);
