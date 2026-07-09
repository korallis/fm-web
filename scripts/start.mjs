#!/usr/bin/env bun
// One-command launch: server + client dev servers together, sharing this shell's env (FM_HOME etc).

import { createServer } from "node:net";
import { dirname, isAbsolute } from "node:path";
import { loadPortFromEnv } from "../shared/src/index.ts";

async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.close((error) => (error == null ? resolve() : reject(error)));
    });
  });
}

if (process.env.FM_HOME === undefined || process.env.FM_HOME === "") {
  console.error("FM_HOME must be set to a firstmate home directory (see README.md).");
  process.exit(1);
}
if (!isAbsolute(process.env.FM_HOME)) {
  console.error(`FM_HOME must be an absolute path (got "${process.env.FM_HOME}").`);
  process.exit(1);
}

const port = loadPortFromEnv(process.env);
try {
  await assertPortAvailable(port);
} catch (error) {
  const code =
    error !== null && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`FM Deck server port ${port} is unavailable (${code}).`);
  process.exit(1);
}

const bun = process.execPath;
const childEnv = { ...process.env, PATH: `${dirname(bun)}:${process.env.PATH ?? ""}` };
const children = [
  Bun.spawn([bun, "run", "--cwd", "server", "dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    env: childEnv,
  }),
  Bun.spawn([bun, "run", "--cwd", "client", "dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    env: childEnv,
  }),
];

function shutdown() {
  for (const child of children) child.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const firstExitCode = await Promise.race(children.map((child) => child.exited));
shutdown();
process.exit(typeof firstExitCode === "number" ? firstExitCode : 1);
