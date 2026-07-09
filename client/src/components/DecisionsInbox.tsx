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

function DecisionCard({ item, onReply }: { item: DecisionItem; onReply: (item: DecisionItem) => void }) {
  return (
    <li className="flex flex-col gap-1 border border-factory-border bg-factory-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-factory-text">{item.taskId}</span>
        <StateChip label={CATEGORY_LABEL[item.category]} tone={CATEGORY_TONE[item.category]} />
      </div>
      <p className="whitespace-pre-wrap font-mono text-xs text-factory-dim">{item.detail}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-factory-dim">source: {item.source}</span>
        <button
          type="button"
          onClick={() => onReply(item)}
          className="border border-factory-border px-2 py-0.5 font-mono text-[11px] text-factory-dim hover:border-factory-accent hover:text-factory-accent"
        >
          Reply
        </button>
      </div>
    </li>
  );
}

export interface DecisionsInboxProps {
  decisions: readonly DecisionItem[];
  /** Prefills the composer draft with a ready reply and routes there — never a raw bypass. */
  onReply: (item: DecisionItem) => void;
}

/** needs-decision / parked no-mistakes gates, PR-ready, blocked and failed tasks - see adapter/decisions.ts.
 * Reply prefills the composer; the actual send still goes through the one verified-submit channel. */
export function DecisionsInbox({ decisions, onReply }: DecisionsInboxProps) {
  if (decisions.length === 0) {
    return <p className="font-mono text-sm text-factory-dim">No decisions pending.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {decisions.map((item, i) => (
        <DecisionCard key={`${item.taskId}-${item.category}-${i}`} item={item} onReply={onReply} />
      ))}
    </ul>
  );
}
