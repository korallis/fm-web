import type { WatchTriageEntry } from "@fm-web/shared";

// `fm-watch.sh`'s `triage_log()` writes `[%Y-%m-%dT%H:%M:%S%z] <message>`, one line per absorbed
// (benign) wake. Debug trail only — never relied on for correctness, safe to be defensive here.
const LINE_RE = /^\[([^\]]+)]\s?(.*)$/;

/** Parse `state/.watch-triage.log`. Size-capped by the watcher itself; read verbatim, no truncation here. */
export function parseWatchTriageLog(content: string): WatchTriageEntry[] {
  const entries: WatchTriageEntry[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const match = LINE_RE.exec(line);
    if (!match) {
      entries.push({ timestampMs: null, message: line, raw: line });
      continue;
    }
    const [, tsRaw, message] = match as unknown as [string, string, string];
    const parsed = Date.parse(tsRaw);
    entries.push({ timestampMs: Number.isNaN(parsed) ? null : parsed, message, raw: line });
  }
  return entries;
}
