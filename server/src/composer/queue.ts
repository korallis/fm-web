import type { ComposerQueueEntry, ComposerSendResult, ComposerState, LockInfo } from "@fm-web/shared";
import type { SubmitVerdict } from "../tmux/submit.js";

/**
 * Busy-aware verified-submit send queue for the app-owned first-mate session: every instruction
 * path (free-form composer, skill quick-actions, future inbox/task-card actions) converges on
 * `enqueue`, which serializes sends, waits out a busy harness instead of interleaving keystrokes
 * mid-turn, and refuses to send at all while another live session holds the lock.
 */

export interface ComposerQueueDeps {
  submit: (text: string) => Promise<SubmitVerdict>;
  isBusy: () => Promise<boolean>;
  isReadOnly: () => Promise<boolean>;
  getLock: () => Promise<LockInfo>;
  isSessionReady: () => Promise<boolean>;
  skillInvocationPrefix?: "/" | "$";
  busyPollMs?: number;
}

const MAX_HISTORY = 50;
const DEFAULT_BUSY_POLL_MS = 1000;

export class ComposerQueue {
  private entries: ComposerQueueEntry[] = [];
  private running = false;
  private nextId = 0;
  private readonly listeners = new Set<(state: ComposerState) => void>();

  constructor(private readonly deps: ComposerQueueDeps) {}

  onStateChange(listener: (state: ComposerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** "session not ready" outranks "read-only": a session that never started isn't held by anyone else. */
  private async blockReason(): Promise<string | null> {
    if (!(await this.deps.isSessionReady())) return "the app-owned first-mate session is not available";
    if (await this.deps.isReadOnly()) return "read-only: another live firstmate session holds the lock";
    return null;
  }

  async enqueue(text: string): Promise<ComposerSendResult> {
    const trimmed = text.trim();
    if (trimmed === "") return { accepted: false, error: "cannot send empty text" };
    const blocked = await this.blockReason();
    if (blocked !== null) return { accepted: false, error: blocked };
    this.nextId += 1;
    const id = `q${this.nextId}`;
    this.entries.push({ id, text: trimmed, enqueuedAtMs: Date.now(), status: "queued" });
    this.prune();
    await this.emitState();
    void this.runWorker();
    return { accepted: true, entryId: id };
  }

  getEntries(): ComposerQueueEntry[] {
    return [...this.entries];
  }

  private prune(): void {
    if (this.entries.length <= MAX_HISTORY) return;
    const pending = this.entries.filter((e) => e.status === "queued" || e.status === "sending");
    const resolved = this.entries.filter((e) => e.status === "sent" || e.status === "failed");
    const keepResolved = resolved.slice(-Math.max(0, MAX_HISTORY - pending.length));
    this.entries = [...pending, ...keepResolved].sort((a, b) => a.enqueuedAtMs - b.enqueuedAtMs);
  }

  private failAllQueued(reason: string): void {
    for (const entry of this.entries) {
      if (entry.status === "queued" || entry.status === "sending") {
        entry.status = "failed";
        entry.detail = reason;
      }
    }
  }

  private async waitWhileBusy(): Promise<void> {
    const pollMs = this.deps.busyPollMs ?? DEFAULT_BUSY_POLL_MS;
    while (await this.deps.isBusy()) {
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, pollMs));
    }
  }

  private async runWorker(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const next = this.entries.find((e) => e.status === "queued");
        if (next === undefined) break;
        const blocked = await this.blockReason();
        if (blocked !== null) {
          this.failAllQueued(blocked);
          await this.emitState();
          break;
        }
        next.status = "sending";
        await this.emitState();
        await this.waitWhileBusy();
        const blockedAfterWait = await this.blockReason();
        if (blockedAfterWait !== null) {
          this.failAllQueued(blockedAfterWait);
          await this.emitState();
          break;
        }
        const verdict = await this.deps.submit(next.text);
        if (verdict === "empty" || verdict === "unknown") {
          next.status = "sent";
          if (verdict === "unknown") next.detail = "sent (pane unreadable — assumed delivered)";
        } else if (verdict === "pending") {
          const detail = "Enter was swallowed - text may still be in the composer";
          next.status = "failed";
          next.detail = detail;
          this.failAllQueued(detail);
          this.prune();
          await this.emitState();
          break;
        } else {
          next.status = "failed";
          next.detail = "send failed";
        }
        this.prune();
        await this.emitState();
      }
    } finally {
      this.running = false;
    }
  }

  async buildState(): Promise<ComposerState> {
    const [lock, busy, readOnly, sessionReady] = await Promise.all([
      this.deps.getLock(),
      this.deps.isBusy(),
      this.deps.isReadOnly(),
      this.deps.isSessionReady(),
    ]);
    return {
      busy,
      readOnly,
      skillInvocationPrefix: this.deps.skillInvocationPrefix ?? "/",
      lock,
      queue: this.getEntries(),
      sessionReady,
    };
  }

  private async emitState(): Promise<void> {
    const state = await this.buildState();
    for (const listener of this.listeners) listener(state);
  }
}
