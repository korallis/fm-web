import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capturePaneVisibleAnsi, pipePaneAppend } from "./tmuxClient.js";

/**
 * Streams an app-owned session's pane output to xterm.js: `pipe-pane -o` continuously appends the
 * pane's raw bytes (full ANSI, cursor movement, the works — exactly what a terminal emulator
 * needs) to a log file THIS app owns (never under `fmHome`); `PaneTailer` follows new bytes.
 * `capture-pane -e` separately provides an on-connect resync snapshot of the current screen.
 */

const LOG_DIR = join(tmpdir(), "fm-deck-sessions");
const SAFETY_POLL_MS = 1000;

export function logPathFor(sessionName: string): string {
  return join(LOG_DIR, `${sessionName}.log`);
}

/** Idempotent: `pipe-pane -o` only opens a new pipe if the pane isn't already piped. */
export async function ensurePaneStream(target: string, sessionName: string): Promise<string> {
  mkdirSync(LOG_DIR, { recursive: true });
  const path = logPathFor(sessionName);
  if (!existsSync(path)) closeSync(openSync(path, "a"));
  await pipePaneAppend(target, path);
  return path;
}

function isVisuallyBlank(line: string): boolean {
  // eslint-disable-next-line no-control-regex -- matching the ESC (0x1b) CSI lead-in is the point.
  return line.replace(/\x1b\[[0-9;:]*[a-zA-Z]/g, "").trim() === "";
}

/**
 * Converts a `capture-pane -e` visible-screen snapshot into text xterm.js can `write()` directly.
 * tmux always captures the FULL configured pane height (blank rows below the prompt included);
 * trailing blank rows are trimmed first so a browser terminal shorter than that pane doesn't
 * scroll real content out of view behind a wall of padding.
 */
export function paneSnapshotToXterm(raw: string): string {
  const lines = raw.split("\n");
  while (lines.length > 0 && isVisuallyBlank(lines[lines.length - 1] ?? "")) lines.pop();
  return lines.map((line) => `${line}\x1b[0m`).join("\r\n");
}

export async function captureResyncSnapshot(target: string): Promise<string | null> {
  const raw = await capturePaneVisibleAnsi(target);
  return raw === null ? null : paneSnapshotToXterm(raw);
}

export type ChunkListener = (text: string) => void;

/**
 * Follows new bytes appended to a pipe-pane log file, decoding as UTF-8 with a persistent
 * streaming decoder so a multi-byte character split across two reads never emits a replacement
 * character. Starts from the file's CURRENT size — historical content from a previous server run
 * is not replayed (the on-connect `capture-pane -e` snapshot covers "what's on screen now").
 */
export class PaneTailer {
  private position: number;
  private readonly decoder = new TextDecoder();
  private readonly listeners = new Set<ChunkListener>();
  private watcher: FSWatcher | null = null;
  private safetyTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly logPath: string) {
    this.position = statSync(logPath, { throwIfNoEntry: false })?.size ?? 0;
  }

  onChunk(listener: ChunkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.watcher !== null || this.safetyTimer !== null) return;
    try {
      this.watcher = watch(this.logPath, () => this.checkForUpdates());
    } catch {
      this.watcher = null;
    }
    this.safetyTimer = setInterval(() => this.checkForUpdates(), SAFETY_POLL_MS);
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.safetyTimer !== null) clearInterval(this.safetyTimer);
    this.safetyTimer = null;
  }

  /** Reads and dispatches any bytes appended since the last check. Exposed (not just timer-driven) so callers/tests can force a synchronous check instead of racing the poll interval. */
  checkForUpdates(): void {
    const stat = statSync(this.logPath, { throwIfNoEntry: false });
    if (stat === undefined || stat.size <= this.position) return;
    const length = stat.size - this.position;
    const buffer = Buffer.alloc(length);
    const fd = openSync(this.logPath, "r");
    try {
      readSync(fd, buffer, 0, length, this.position);
    } finally {
      closeSync(fd);
    }
    this.position = stat.size;
    const text = this.decoder.decode(buffer, { stream: true });
    if (text.length === 0) return;
    for (const listener of this.listeners) listener(text);
  }
}
