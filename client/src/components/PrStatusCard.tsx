import type { PrStatus } from "@fm-web/shared";
import { StateChip } from "./StateChip";

export function PrStatusCard({ pr }: { pr: PrStatus }) {
  if (pr.url === null) {
    return <p className="font-mono text-xs text-factory-dim">No PR opened yet.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border border-factory-border bg-factory-panel p-2">
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs text-factory-accent underline"
      >
        {pr.url}
      </a>
      {pr.headSha !== null && <StateChip label={`head: ${pr.headSha.slice(0, 8)}`} tone="neutral" />}
      <StateChip
        label={pr.pollArmed ? "merge poll: armed" : "merge poll: not armed"}
        tone={pr.pollArmed ? "accent" : "neutral"}
      />
    </div>
  );
}
