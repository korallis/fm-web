import type { CrewState, CrewStateOutput, CrewStateSource } from "@fm-web/shared";

const STATES: readonly CrewState[] = ["working", "parked", "done", "blocked", "failed", "unknown"];
const SOURCES: readonly CrewStateSource[] = ["run-step", "pane", "status-log", "none"];

function isCrewState(value: string): value is CrewState {
  return (STATES as readonly string[]).includes(value);
}

function isCrewStateSource(value: string): value is CrewStateSource {
  return (SOURCES as readonly string[]).includes(value);
}

// `" · "` (middle dot, U+00B7) is the literal separator `fm-crew-state.sh` prints between fields.
const LINE_RE = /^state: (\S+) · source: (\S+) · (.*)$/;

/**
 * Parse one line of `bin/fm-crew-state.sh <id>` stdout:
 * `state: <state> · source: <source> · <detail>`.
 * Unrecognized state/source tokens fall back to "unknown"/"none" defensively rather than throwing,
 * with the raw line folded into detail so nothing is silently lost.
 */
export function parseCrewStateOutput(line: string): CrewStateOutput {
  const trimmed = line.trim();
  const match = LINE_RE.exec(trimmed);
  if (!match) {
    return { state: "unknown", source: "none", detail: trimmed };
  }
  const [, rawState, rawSource, detail] = match as unknown as [string, string, string, string];
  return {
    state: isCrewState(rawState) ? rawState : "unknown",
    source: isCrewStateSource(rawSource) ? rawSource : "none",
    detail,
  };
}
