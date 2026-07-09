import type { DecisionCategory, DecisionItem } from "@fm-web/shared";
import { StateChip, type ChipTone } from "./StateChip";

const CATEGORY_LABEL: Record<DecisionCategory, string> = {
  "needs-decision": "Needs decision",
  "parked-gate": "Parked gate",
  done: "PR-ready",
  blocked: "Blocked",
  failed: "Failed",
};

const CATEGORY_TONE: Record<DecisionCategory, ChipTone> = {
  "needs-decision": "warn",
  "parked-gate": "warn",
  done: "done",
  blocked: "warn",
  failed: "danger",
};

function DecisionCard({ item }: { item: DecisionItem }) {
  return (
    <li className="flex flex-col gap-1 border border-factory-border bg-factory-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-factory-text">{item.taskId}</span>
        <StateChip label={CATEGORY_LABEL[item.category]} tone={CATEGORY_TONE[item.category]} />
      </div>
      <p className="whitespace-pre-wrap font-mono text-xs text-factory-dim">{item.detail}</p>
      <span className="font-mono text-[11px] text-factory-dim">source: {item.source}</span>
    </li>
  );
}

/** Read-only: needs-decision / parked no-mistakes gates, PR-ready, blocked and failed tasks - see adapter/decisions.ts. */
export function DecisionsInbox({ decisions }: { decisions: readonly DecisionItem[] }) {
  if (decisions.length === 0) {
    return <p className="font-mono text-sm text-factory-dim">No decisions pending.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {decisions.map((item, i) => (
        <DecisionCard key={`${item.taskId}-${item.category}-${i}`} item={item} />
      ))}
    </ul>
  );
}
