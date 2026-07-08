import type { DecisionItem, FleetTask } from "@fm-web/shared";

/** Prefer the verbatim status-log line; fall back to the crew-state detail (also verbatim, just less complete). */
function detailFor(task: FleetTask): string {
  return task.latestStatus?.raw ?? task.crewState.detail;
}

/**
 * Derive the decisions inbox from already-built fleet tasks (no I/O — see `fleetState.ts` for the
 * read side). `fm-crew-state.sh`'s `parked` state is ambiguous by itself: `source: run-step` means a
 * no-mistakes gate is awaiting approval, while any other source means a manual `needs-decision:`
 * status append the log fallback mapped to `parked` for display — see fm-crew-state.sh's
 * `map_log_state()`. Splitting on `source` recovers the two distinct captain-facing categories.
 */
export function buildDecisionsInbox(tasks: readonly FleetTask[]): DecisionItem[] {
  const items: DecisionItem[] = [];
  for (const task of tasks) {
    const { state, source } = task.crewState;
    if (state === "parked") {
      items.push({
        taskId: task.id,
        category: source === "run-step" ? "parked-gate" : "needs-decision",
        detail: source === "run-step" ? task.crewState.detail : detailFor(task),
        source,
      });
    } else if (state === "done" || state === "blocked" || state === "failed") {
      items.push({ taskId: task.id, category: state, detail: detailFor(task), source });
    }
  }
  return items;
}
