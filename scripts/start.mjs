#!/usr/bin/env bun
// One-command launch: server + client dev servers together, sharing this shell's env (FM_HOME etc).

if (process.env.FM_HOME === undefined || process.env.FM_HOME === "") {
  console.error("FM_HOME must be set to a firstmate home directory (see README.md).");
  process.exit(1);
}

const bun = process.execPath;
const children = [
  Bun.spawn([bun, "run", "--cwd", "server", "dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
  Bun.spawn([bun, "run", "--cwd", "client", "dev"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
];

function shutdown() {
  for (const child of children) child.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.race(children.map((child) => child.exited));
shutdown();
