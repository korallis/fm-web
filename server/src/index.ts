import { createBunWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import type { SessionWsMessage } from "@fm-web/shared";
import { createApp } from "./app.js";
import { buildFleetSnapshot } from "./adapter/fleetState.js";
import { readLockInfo } from "./adapter/lock.js";
import { watchFmHome } from "./eventBus/watcher.js";
import { captainRegexFromEnv } from "./adapter/captainClassifier.js";
import { loadTimingFromEnv } from "./adapter/timing.js";
import { loadHarnessCommandFromEnv, loadPortFromEnv } from "./config.js";
import { SnapshotBroadcaster } from "./snapshotBroadcaster.js";
import { ComposerQueue } from "./composer/queue.js";
import {
  ensureFirstMateSession,
  isFirstMateSessionReady,
  isLockHeldByOwnSession,
  isSessionBusy,
} from "./tmux/sessionManager.js";
import { captureResyncSnapshot, ensurePaneStream, PaneTailer } from "./tmux/paneStream.js";
import { submitText } from "./tmux/submit.js";
import { sendKey } from "./tmux/tmuxClient.js";
import { isSameOriginRequest } from "./http/origin.js";

const fmHomeEnv = process.env["FM_HOME"];
if (fmHomeEnv === undefined || fmHomeEnv === "") {
  throw new Error("FM_HOME must be set to a firstmate home directory");
}
const fmHome: string = fmHomeEnv;

const { upgradeWebSocket, websocket } = createBunWebSocket();
const timing = loadTimingFromEnv(process.env);
const captainRegex = captainRegexFromEnv(process.env);
const harnessCommand = loadHarnessCommandFromEnv(process.env);

interface CommandDeckBoot {
  target: string | null;
  tailer: PaneTailer | null;
}

/** Never lets a failed session/tmux bootstrap take down the read-only Bridge dashboard. */
async function bootstrapCommandDeck(home: string, harness: string): Promise<CommandDeckBoot> {
  try {
    const { target, created } = await ensureFirstMateSession(home, harness);
    console.log(`first-mate session ${created ? "started" : "reused"}: ${target}`);
    const sessionName = target.split(":")[0] as string;
    const logPath = await ensurePaneStream(target, sessionName);
    const tailer = new PaneTailer(logPath);
    tailer.start();
    return { target, tailer };
  } catch (error) {
    console.error("Failed to start the app-owned first-mate session; command deck is unavailable", error);
    return { target: null, tailer: null };
  }
}

const deck = await bootstrapCommandDeck(fmHome, harnessCommand);

async function isReadOnly(): Promise<boolean> {
  if (deck.target === null) return true;
  const lock = readLockInfo(fmHome);
  if (lock.pid === null || lock.alive !== true) return false;
  return !(await isLockHeldByOwnSession(deck.target, lock.pid));
}

const composerQueue = new ComposerQueue({
  submit: async (text) => {
    if (deck.target === null) throw new Error("first-mate session unavailable");
    return submitText(deck.target, text, { harness: harnessCommand });
  },
  isBusy: async () => (deck.target === null ? false : isSessionBusy(deck.target)),
  isReadOnly,
  getLock: async () => readLockInfo(fmHome),
  isSessionReady: async () => deck.target !== null && (await isFirstMateSessionReady(fmHome)),
});

const app = createApp(fmHome, {
  timing,
  captainRegex,
  commandDeck: {
    fmHome,
    composerQueue,
    interrupt: async () => {
      if (deck.target === null || (await isReadOnly())) return false;
      return sendKey(deck.target, "C-c");
    },
  },
});

const fleetClients = new Set<WSContext>();
const snapshotBroadcaster = new SnapshotBroadcaster(() =>
  buildFleetSnapshot(fmHome, Date.now(), timing, captainRegex),
);

const logSnapshotError = (error: unknown): void => {
  console.error("Failed to build fleet snapshot", error);
};

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen: (_evt, ws) => {
      fleetClients.add(ws);
      void snapshotBroadcaster.sendTo(ws).catch(logSnapshotError);
    },
    onClose: (_evt, ws) => {
      fleetClients.delete(ws);
    },
  })),
);

watchFmHome(fmHome, () => {
  void snapshotBroadcaster.broadcast(fleetClients).catch(logSnapshotError);
});

const sessionClients = new Set<WSContext>();

function broadcastSessionMessage(message: SessionWsMessage): void {
  const payload = JSON.stringify(message);
  for (const client of sessionClients) client.send(payload);
}

app.use("/ws/session", async (c, next) => {
  if (!isSameOriginRequest(c.req.raw.headers)) return c.text("cross-origin requests are not allowed", 403);
  return next();
});

app.get(
  "/ws/session",
  upgradeWebSocket(() => ({
    onOpen: (_evt, ws) => {
      sessionClients.add(ws);
      void (async () => {
        if (deck.target !== null) {
          const snapshot = await captureResyncSnapshot(deck.target);
          if (snapshot !== null)
            ws.send(JSON.stringify({ type: "snapshot", text: snapshot } satisfies SessionWsMessage));
        }
        const state = await composerQueue.buildState();
        ws.send(JSON.stringify({ type: "composerState", state } satisfies SessionWsMessage));
      })().catch((error: unknown) => {
        console.error("Failed to send initial /ws/session state", error);
      });
    },
    onClose: (_evt, ws) => {
      sessionClients.delete(ws);
    },
  })),
);

deck.tailer?.onChunk((text) => broadcastSessionMessage({ type: "chunk", text }));
composerQueue.onStateChange((state) => broadcastSessionMessage({ type: "composerState", state }));

// Composer state can change independent of our own queue (the harness starting/finishing a turn
// on its own) — poll and broadcast periodically so busy/lock indicators stay live either way.
const COMPOSER_POLL_MS = 2000;
setInterval(() => {
  if (sessionClients.size === 0) return;
  void composerQueue
    .buildState()
    .then((state) => broadcastSessionMessage({ type: "composerState", state }))
    .catch((error: unknown) => {
      console.error("Failed to poll composer state", error);
    });
}, COMPOSER_POLL_MS);

const port = loadPortFromEnv(process.env);

Bun.serve({
  hostname: "127.0.0.1",
  port,
  // Hono's Bun websocket adapter reads the raw Bun `Server` back off `c.env.server`.
  fetch: (req, server) => app.fetch(req, { server }),
  websocket,
});

console.log(`FM Deck server listening on http://127.0.0.1:${port} (FM_HOME=${fmHome})`);
