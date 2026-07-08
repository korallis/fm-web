/**
 * Pure TS port of firstmate's `fm_tmux_strip_ghost` + `fm_tmux_composer_state`
 * (bin/fm-tmux-lib.sh) so the app-owned session's composer/submit logic never drifts from the
 * verified-submit + Enter-swallow detection firstmate itself relies on. See that file for the
 * incident history (afk-invx-i5, composer-robust) behind each rule below.
 */

export type ComposerLineState = "empty" | "pending";

/** Busy footers per harness (mirrors fm-tmux-lib.sh's FM_TMUX_BUSY_REGEX_DEFAULT). */
export const BUSY_REGEX = /esc (to )?interrupt|Working\.\.\.|Ctrl\+c:cancel/i;

const BARE_PROMPT_GLYPHS = new Set([">", "❯", "$", "%", "#"]);

const ESC = "\x1b";

/**
 * Strip dim/faint (ANSI SGR code 2) styled runs from one captured line, then drop remaining
 * escape sequences — leaves only the plain, normal-intensity text a human actually typed. Ghost
 * text (a harness's dim predicted-next-prompt suggestion) is SGR 2 and must never read as
 * pending input.
 */
export function stripGhost(line: string): string {
  let out = "";
  let dim = false;
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === ESC) {
      if (line[i + 1] === "[") {
        let j = i + 2;
        let params = "";
        while (j < n && !/[@-~]/.test(line[j] as string)) {
          params += line[j];
          j++;
        }
        if (j < n && line[j] === "m") {
          const codes = (params === "" ? "0" : params).split(";");
          for (let p = 0; p < codes.length; p++) {
            const code = (codes[p] ?? "").split(":")[0] || "0";
            if (code === "38" || code === "48" || code === "58") {
              // Skip the color payload (indexed: 1 more code; RGB: 3 more codes).
              const raw = codes[p + 1];
              const sub = raw?.split(":")[0];
              if (raw?.includes(":") === true) {
                // colon-separated sub-params already counted as a single token
              } else if (sub === "5") {
                p += 2;
              } else if (sub === "2") {
                p += 4;
              } else {
                p += 1;
              }
            } else if (code === "2") {
              dim = true;
            } else if (code === "0" || code === "22") {
              dim = false;
            }
          }
          i = j + 1;
          continue;
        }
        if (j < n) {
          i = j + 1;
          continue;
        }
      }
      i += 1;
      continue;
    }
    if (!dim) out += c;
    i++;
  }
  return out;
}

/**
 * Classify a captured composer/cursor line (captured WITH ANSI via `capture-pane -e`, bounded to
 * one row) as empty (safe to inject; also the positive ack that a submit landed) or pending (real
 * unsubmitted text — defer/retry). `composerIdleRegex` mirrors FM_COMPOSER_IDLE_RE.
 */
export function classifyComposerLine(rawAnsiLine: string, composerIdleRegex?: RegExp): ComposerLineState {
  const plain = stripGhost(rawAnsiLine);
  const stripped = plain.replaceAll("│", "").replaceAll("┃", "").replaceAll("|", "").trim();
  if (stripped === "") return "empty";
  if (composerIdleRegex !== undefined && composerIdleRegex.test(stripped)) return "empty";
  if (BARE_PROMPT_GLYPHS.has(stripped)) return "empty";
  if (BUSY_REGEX.test(stripped)) return "empty";
  return "pending";
}

/** True if the pane's last few non-blank tail lines show a busy footer (mirrors fm_pane_is_busy). */
export function isBusyFromTail(tail: string, busyRegex: RegExp = BUSY_REGEX): boolean {
  const nonBlank = tail
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(-6);
  return nonBlank.some((line) => busyRegex.test(line));
}
