import type { StatusEntry, StatusVerb } from "@fm-web/shared";

const KNOWN_VERBS: readonly StatusVerb[] = ["working", "needs-decision", "blocked", "done", "failed"];

function toVerb(rawVerb: string): StatusVerb {
  return (KNOWN_VERBS as readonly string[]).includes(rawVerb) ? (rawVerb as StatusVerb) : "unknown";
}

/**
 * Parse `state/<id>.status` - an append-only log of `"{verb}: {note}"` lines.
 * NEVER current-state truth on its own; see `crewState.ts` for the real state grammar.
 */
export function parseStatusLog(content: string): StatusEntry[] {
  const entries: StatusEntry[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const colon = line.indexOf(":");
    const rawVerb = colon === -1 ? line : line.slice(0, colon).trim();
    const note = colon === -1 ? "" : line.slice(colon + 1).trim();
    entries.push({ verb: toVerb(rawVerb), rawVerb, note, raw: line });
  }
  return entries;
}

export function latestStatus(entries: readonly StatusEntry[]): StatusEntry | null {
  return entries.at(-1) ?? null;
}
