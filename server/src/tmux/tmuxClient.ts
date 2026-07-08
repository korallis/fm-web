import { execFile } from "node:child_process";

/**
 * Thin wrappers around the `tmux` binary for the app-owned first-mate session. This is generic
 * tmux control (send-keys/capture-pane/pipe-pane on a session THIS app created) — never a
 * firstmate script, so it sits outside the safety module's allowlist entirely.
 */

export interface TmuxResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runTmux(args: readonly string[]): Promise<TmuxResult> {
  return new Promise((resolvePromise) => {
    execFile("tmux", args as string[], { encoding: "utf8" }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
      resolvePromise({ code, stdout, stderr });
    });
  });
}

export async function hasSession(sessionName: string): Promise<boolean> {
  const result = await runTmux(["has-session", "-t", sessionName]);
  return result.code === 0;
}

export interface NewSessionOptions {
  sessionName: string;
  windowName: string;
  cwd: string;
  command: string;
  width?: number;
  height?: number;
}

export async function newSession(options: NewSessionOptions): Promise<TmuxResult> {
  const args = ["new-session", "-d", "-s", options.sessionName, "-n", options.windowName, "-c", options.cwd];
  if (options.width !== undefined) args.push("-x", String(options.width));
  if (options.height !== undefined) args.push("-y", String(options.height));
  args.push(options.command);
  return runTmux(args);
}

export async function sendLiteral(target: string, text: string): Promise<boolean> {
  const result = await runTmux(["send-keys", "-t", target, "-l", "--", text]);
  return result.code === 0;
}

export async function sendKey(target: string, key: string): Promise<boolean> {
  const result = await runTmux(["send-keys", "-t", target, key]);
  return result.code === 0;
}

export async function cursorY(target: string): Promise<number | null> {
  const result = await runTmux(["display-message", "-p", "-t", target, "#{cursor_y}"]);
  if (result.code !== 0) return null;
  const value = Number(result.stdout.trim());
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/** Capture one pane row WITH ANSI styling (SGR), used for composer/cursor-line classification. */
export async function capturePaneLineAnsi(target: string, line: number): Promise<string | null> {
  const result = await runTmux([
    "capture-pane",
    "-e",
    "-p",
    "-t",
    target,
    "-S",
    String(line),
    "-E",
    String(line),
  ]);
  return result.code === 0 ? result.stdout : null;
}

/** Capture the visible screen WITH ANSI styling, for an xterm.js resync snapshot on (re)connect. */
export async function capturePaneVisibleAnsi(target: string): Promise<string | null> {
  const result = await runTmux(["capture-pane", "-e", "-p", "-t", target]);
  return result.code === 0 ? result.stdout : null;
}

/** Capture the last `lines` non-styled rows, used for the busy-footer tail check. */
export async function capturePaneTail(target: string, lines: number): Promise<string | null> {
  const result = await runTmux(["capture-pane", "-p", "-t", target, "-S", `-${lines}`]);
  return result.code === 0 ? result.stdout : null;
}

export async function panePid(target: string): Promise<number | null> {
  const result = await runTmux(["list-panes", "-t", target, "-F", "#{pane_pid}"]);
  if (result.code !== 0) return null;
  const firstLine = result.stdout.split(/\r?\n/).find((line) => line.trim() !== "");
  if (firstLine === undefined) return null;
  const value = Number(firstLine.trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** `-o`: only opens the pipe if none is active yet, so re-calling on an already-piped pane is a no-op. */
export async function pipePaneAppend(target: string, filePath: string): Promise<boolean> {
  const escaped = filePath.replace(/'/g, "'\\''");
  const result = await runTmux(["pipe-pane", "-o", "-t", target, `cat >> '${escaped}'`]);
  return result.code === 0;
}

export async function killSession(sessionName: string): Promise<void> {
  await runTmux(["kill-session", "-t", sessionName]);
}
