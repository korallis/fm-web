import { isAbsolute } from "node:path";
import { createBunWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import type { SessionWsMessage } from "@fm-web/shared";
import { createApp } from "./app.js";
import { readLockInfo } from "./adapter/lock.js";
import { resolveHomeId } from "./adapter/homes.js";
import { HomeChannelRegistry } from "./eventBus/homeChannels.js";
import { captainRegexFromEnv } from "./adapter/captainClassifier.js";
import { loadTimingFromEnv } from "./adapter/timing.js";
import { loadHarnessCommandFromEnv, loadPortFromEnv } from "./config.js";
import { ComposerQueue } from "./composer/queue.js";
import { bootstrapCommandDeck } from "./commandDeck/bootstrap.js";
import { isFirstMateSessionReady, isLockHeldByOwnSession, isSessionBusy } from "./tmux/sessionManager.js";
import { captureResyncSnapshot } from "./tmux/paneStream.js";
import { skillInvocationPrefixForHarness, submitText } from "./tmux/submit.js";
import { sendKey } from "./tmux/tmuxClient.js";
import { isSameOriginRequest } from "./http/origin.js";

const fmHomeEnv = process.env["FM_HOME"];
if (fmHomeEnv === undefined || fmHomeEnv === "") {
  throw new Error("FM_HOME must be set to a firstmate home directory");
}
if (!isAbsolute(fmHomeEnv)) {
  // Every workspace's own dev/build script (`bun run --cwd server ...`) changes the process's cwd
  // before this file ever runs, so a relative FM_HOME resolves against whichever workspace happened
  // to spawn the server - silently reading an empty/wrong home instead of failing loudly.
  throw new Error(
    `FM_HOME must be an absolute path (got "${fmHomeEnv}") - a relative path resolves differently ` +
      "depending on which workspace script started the server.",
  );
}
const fmHome: string = fmHomeEnv;

const { upgradeWebSocket, websocket } = createBunWebSocket();
const timing = loadTimingFromEnv(process.env);
const captainRegex = captainRegexFromEnv(process.env);
const harnessCommand = loadHarnessCommandFromEnv(process.env);

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
  skillInvocationPrefix: skillInvocationPrefixForHarness(harnessCommand),
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
    isReadOnly,
  },
});

const logSnapshotError = (error: unknown): void => {
  console.error("Failed to build fleet snapshot", error);
};

const homeChannels = new HomeChannelRegistry(timing, captainRegex, logSnapshotError);

app.use("/ws", async (c, next) => {
  if (!isSameOriginRequest(c.req.raw.headers)) return c.text("cross-origin requests are not allowed", 403);
  if (resolveHomeId(fmHome, c.req.query("home")) === null) return c.text("unknown home id", 400);
  return next();
});

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const channel = homeChannels.get(resolveHomeId(fmHome, c.req.query("home")) ?? fmHome);
    return {
      onOpen: (_evt, ws) => {
        channel.clients.add(ws);
        void channel.broadcaster.sendTo(ws).catch(logSnapshotError);
      },
      onClose: (_evt, ws) => {
        channel.clients.delete(ws);
      },
    };
  }),
);

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
// on its own) - poll and broadcast periodically so busy/lock indicators stay live either way.
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
