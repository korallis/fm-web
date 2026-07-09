import { capturePaneLineAnsi, cursorY, sendKey, sendLiteral } from "./tmuxClient.js";
import { classifyComposerLine, type ComposerLineState } from "./composerState.js";

/**
 * TS port of `fm_tmux_submit_core` / `fm_tmux_submit_enter_core` (bin/fm-tmux-lib.sh), targeted
 * at the app-owned session:window instead of a firstmate-tracked crewmate. Type once, submit with
 * Enter, retry Enter ONLY (never retype — a swallowed Enter already left our text in the composer).
 */
export type SubmitVerdict = ComposerLineState | "unknown" | "send-failed";

export interface SubmitOptions {
  retries?: number;
  enterSleepMs?: number;
  settleMs?: number;
  /** Extra pause after a landed submit, mirroring fm-send.sh's FM_SEND_SETTLE (the harness needs a
   * beat to spin up the turn before its busy footer appears). */
  postSubmitSettleMs?: number;
  composerIdleRegex?: RegExp;
  /** Scopes the codex `$<skill>` long-settle rule in `selectSettleMs`; unset = non-codex default. */
  harness?: string;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_ENTER_SLEEP_MS = 400;
const DEFAULT_POST_SUBMIT_SETTLE_MS = 1000;
const SLASH_COMMAND_SETTLE_MS = 1200;
const CODEX_SKILL_SETTLE_MS = 1200;
const DEFAULT_SETTLE_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/** Reads and classifies the composer/cursor line; "unknown" when the pane can't be read at all. */
export async function readComposerState(
  target: string,
  composerIdleRegex?: RegExp,
): Promise<ComposerLineState | "unknown"> {
  const cy = await cursorY(target);
  if (cy === null) return "unknown";
  const raw = await capturePaneLineAnsi(target, cy);
  if (raw === null) return "unknown";
  return classifyComposerLine(raw, composerIdleRegex);
}

/**
 * Pre-Enter settle: slash commands open a completion popup in some TUIs, and codex opens the
 * same kind of popup for a `$<skill>` invocation — submitting too fast selects nothing. Scoped to
 * codex on purpose: a leading `$` commonly starts plain text ("$5/month") in other harnesses.
 */
export function selectSettleMs(text: string, harness?: string): number {
  if (text.startsWith("/")) return SLASH_COMMAND_SETTLE_MS;
  if (text.startsWith("$") && harness === "codex") return CODEX_SKILL_SETTLE_MS;
  return DEFAULT_SETTLE_MS;
}

async function submitEnterCore(
  target: string,
  retries: number,
  enterSleepMs: number,
  composerIdleRegex: RegExp | undefined,
): Promise<SubmitVerdict> {
  let attempt = 0;
  for (;;) {
    const sent = await sendKey(target, "Enter");
    if (!sent) return "send-failed";
    await sleep(enterSleepMs);
    const state = await readComposerState(target, composerIdleRegex);
    if (state !== "pending") return state;
    attempt += 1;
    if (attempt >= retries) return "pending";
  }
}

/**
 * Type `text` into `target` ONCE, then submit with Enter, verifying the composer cleared.
 * Verdict: "empty" (submitted), "pending" (positively-confirmed swallowed Enter — the caller
 * should treat this as a failed steer), "unknown" (pane unreadable — lenient: assume sent), or
 * "send-failed" (the initial send-keys itself failed).
 */
export async function submitText(
  target: string,
  text: string,
  options: SubmitOptions = {},
): Promise<SubmitVerdict> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const enterSleepMs = options.enterSleepMs ?? DEFAULT_ENTER_SLEEP_MS;
  const settleMs = options.settleMs ?? selectSettleMs(text, options.harness);
  const postSubmitSettleMs = options.postSubmitSettleMs ?? DEFAULT_POST_SUBMIT_SETTLE_MS;

  const sent = await sendLiteral(target, text);
  if (!sent) return "send-failed";
  await sleep(settleMs);
  const verdict = await submitEnterCore(target, retries, enterSleepMs, options.composerIdleRegex);
  if (verdict !== "pending" && verdict !== "send-failed" && postSubmitSettleMs > 0)
    await sleep(postSubmitSettleMs);
  return verdict;
}
