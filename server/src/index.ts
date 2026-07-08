import { createBunWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { createApp } from "./app.js";
import { buildFleetSnapshot } from "./adapter/fleetState.js";
import { watchFmHome } from "./eventBus/watcher.js";
import { captainRegexFromEnv } from "./adapter/captainClassifier.js";
import { loadTimingFromEnv } from "./adapter/timing.js";
import { loadPortFromEnv } from "./config.js";

const fmHome = process.env["FM_HOME"];
if (fmHome === undefined || fmHome === "") {
  throw new Error("FM_HOME must be set to a firstmate home directory");
}

const { upgradeWebSocket, websocket } = createBunWebSocket();
const timing = loadTimingFromEnv(process.env);
const captainRegex = captainRegexFromEnv(process.env);
const app = createApp(fmHome, { timing, captainRegex });
const clients = new Set<WSContext>();

const logSnapshotError = (error: unknown): void => {
  console.error("Failed to build fleet snapshot", error);
};

const sendSnapshot = async (client: WSContext): Promise<void> => {
  client.send(JSON.stringify(await buildFleetSnapshot(fmHome, Date.now(), timing, captainRegex)));
};

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen: (_evt, ws) => {
      clients.add(ws);
      void sendSnapshot(ws).catch(logSnapshotError);
    },
    onClose: (_evt, ws) => {
      clients.delete(ws);
    },
  })),
);

const broadcastSnapshot = async (): Promise<void> => {
  const snapshot = JSON.stringify(await buildFleetSnapshot(fmHome, Date.now(), timing, captainRegex));
  for (const client of clients) client.send(snapshot);
};

watchFmHome(fmHome, () => {
  void broadcastSnapshot().catch(logSnapshotError);
});

const port = loadPortFromEnv(process.env);

Bun.serve({
  hostname: "127.0.0.1",
  port,
  // Hono's Bun websocket adapter reads the raw Bun `Server` back off `c.env.server`.
  fetch: (req, server) => app.fetch(req, { server }),
  websocket,
});

console.log(`FM Deck server listening on http://127.0.0.1:${port} (FM_HOME=${fmHome})`);
