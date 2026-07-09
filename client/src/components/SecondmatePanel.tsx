import type { SecondmateEntry } from "@fm-web/shared";
import { StateChip } from "./StateChip";

function SecondmateCard({ secondmate }: { secondmate: SecondmateEntry }) {
  return (
    <li className="flex flex-col gap-1 border border-factory-border bg-factory-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm text-factory-text">{secondmate.id}</span>
        <span className="truncate font-mono text-[11px] text-factory-dim" title={secondmate.home}>
          {secondmate.home}
        </span>
      </div>
      <p className="font-mono text-xs text-factory-dim">{secondmate.summary}</p>
      <p className="font-mono text-[11px] text-factory-dim">scope: {secondmate.scope}</p>
      <div className="flex flex-wrap items-center gap-1">
        {secondmate.projects.map((project) => (
          <StateChip key={project} label={project} tone="neutral" />
        ))}
        <span className="ml-auto font-mono text-[11px] text-factory-dim">added {secondmate.added}</span>
      </div>
    </li>
  );
}

/** Read-only view of `data/secondmates.md` - see adapter/secondmates.ts. Never mutated from here;
 * projects.md-style edits belong to firstmate's own home-seed flow. */
export function SecondmatePanel({ secondmates }: { secondmates: readonly SecondmateEntry[] }) {
  if (secondmates.length === 0) {
    return <p className="font-mono text-sm text-factory-dim">No secondmates registered.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {secondmates.map((secondmate) => (
        <SecondmateCard key={secondmate.id} secondmate={secondmate} />
      ))}
    </ul>
  );
}
