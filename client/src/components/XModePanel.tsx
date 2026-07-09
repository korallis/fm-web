import type { FleetTask } from "@fm-web/shared";
import { StateChip } from "./StateChip";

const MAX_FOLLOWUPS = 3;

function formatLinkedAt(tsRaw: string | undefined): string {
  if (tsRaw === undefined) return "unknown time";
  const epochSeconds = Number(tsRaw);
  if (!Number.isFinite(epochSeconds)) return tsRaw;
  return new Date(epochSeconds * 1000).toLocaleString();
}

function XModeCard({ task }: { task: FleetTask }) {
  const followups = Number(task.meta.x_followups ?? "0");
  return (
    <li className="flex flex-wrap items-center gap-2 border border-factory-border bg-factory-panel px-3 py-2">
      <span className="font-mono text-sm text-factory-text">{task.id}</span>
      <StateChip label={`request ${task.meta.x_request}`} tone="accent" />
      <span className="font-mono text-[11px] text-factory-dim">
        linked {formatLinkedAt(task.meta.x_request_ts)}
      </span>
      <span className="ml-auto font-mono text-[11px] text-factory-dim">
        follow-ups {Number.isFinite(followups) ? followups : 0}/{MAX_FOLLOWUPS}
      </span>
    </li>
  );
}

/** Read-only view of tasks with an X-mode relay link (`meta.x_request`/`x_request_ts`/`x_followups`
 * from `bin/fm-x-link.sh` - see AGENTS.md/section 14 of the firstmate reference). Optional feature:
 * empty whenever X mode is not paired, which is the common case. */
export function XModePanel({ tasks }: { tasks: readonly FleetTask[] }) {
  const linked = tasks.filter((task) => task.meta.x_request !== undefined);
  if (linked.length === 0) {
    return <p className="font-mono text-sm text-factory-dim">No X-mode requests linked.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {linked.map((task) => (
        <XModeCard key={task.id} task={task} />
      ))}
    </ul>
  );
}
