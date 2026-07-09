import { ensureFirstMateSession, type EnsureSessionResult } from "../tmux/sessionManager.js";
import { ensurePaneStream, PaneTailer } from "../tmux/paneStream.js";
import { killSession } from "../tmux/tmuxClient.js";

export interface CommandDeckBoot {
  target: string | null;
  tailer: PaneTailer | null;
}

export interface BootstrapCommandDeckDeps {
  ensureSession: (home: string, harness: string) => Promise<EnsureSessionResult>;
  ensureStream: (target: string, sessionName: string) => Promise<string>;
  createTailer: (logPath: string) => PaneTailer;
  killSession: (sessionName: string) => Promise<void>;
  logger: Pick<Console, "log" | "error">;
}

const defaultDeps: BootstrapCommandDeckDeps = {
  ensureSession: ensureFirstMateSession,
  ensureStream: ensurePaneStream,
  createTailer: (logPath) => new PaneTailer(logPath),
  killSession,
  logger: console,
};

export async function bootstrapCommandDeck(
  home: string,
  harness: string,
  deps: BootstrapCommandDeckDeps = defaultDeps,
): Promise<CommandDeckBoot> {
  let createdSessionName: string | null = null;
  try {
    const { target, created } = await deps.ensureSession(home, harness);
    deps.logger.log(`first-mate session ${created ? "started" : "reused"}: ${target}`);
    const sessionName = target.split(":")[0] as string;
    if (created) createdSessionName = sessionName;
    const logPath = await deps.ensureStream(target, sessionName);
    const tailer = deps.createTailer(logPath);
    tailer.start();
    return { target, tailer };
  } catch (error) {
    if (createdSessionName !== null) {
      try {
        await deps.killSession(createdSessionName);
      } catch (killError) {
        deps.logger.error("Failed to clean up the newly-created first-mate session", killError);
      }
    }
    deps.logger.error("Failed to start the app-owned first-mate session; command deck is unavailable", error);
    return { target: null, tailer: null };
  }
}
