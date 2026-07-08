import type { StatusEntry } from "@fm-web/shared";
import { StateChip } from "./StateChip";
import { toneForVerb } from "./chipTone";

/**
 * Renders the COMPLETE `.status` log, oldest first. This is history/wake-events only — crews
 * append a line only on a wake-worthy transition, so the last line can go stale once firstmate
 * resolves a gate and the crew resumes. Current state always comes from `crewState`
 * (`fm-crew-state.sh`), rendered separately above this timeline; never inferred from its tail.
 */
export function StatusTimeline({ history }: { history: readonly StatusEntry[] }) {
  if (history.length === 0) {
    return <p className="font-mono text-xs text-factory-dim">No status log entries yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-wide text-factory-dim">
        History / wake events — not current state
      </p>
      <ol className="flex flex-col gap-2">
        {history.map((entry, index) => (
          // Append-only log: no stable id per line, so the source order is the only key available.
          <li key={index} className="border border-factory-border bg-factory-panel p-2">
            <div className="mb-1 flex items-center gap-2">
              <StateChip label={entry.rawVerb} tone={toneForVerb(entry.verb)} />
            </div>
            <p className="font-mono text-xs text-factory-text">{entry.note || entry.raw}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
