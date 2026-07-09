import { decodeGateStatus } from "../lib/decodeGateStatus";
import { StateChip } from "./StateChip";
import type { ChipTone } from "./StateChip";

const STEP_STATUS_TONE: Record<string, ChipTone> = {
  completed: "done",
  passed: "done",
  running: "accent",
  fixing: "accent",
  awaiting_approval: "warn",
  fix_review: "warn",
  failed: "danger",
  cancelled: "danger",
};

function toneForStepStatus(status: string): ChipTone {
  return STEP_STATUS_TONE[status] ?? "neutral";
}

function formatDuration(ms: number | string | undefined): string {
  if (typeof ms !== "number") return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function GateFindingsPanel({ gateStatusRaw }: { gateStatusRaw: string | null }) {
  if (gateStatusRaw === null) {
    return (
      <p className="font-mono text-xs text-factory-dim">No no-mistakes run found for this task's worktree.</p>
    );
  }

  const decoded = decodeGateStatus(gateStatusRaw);
  if (decoded === null) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap border border-factory-border bg-factory-panel p-2 font-mono text-xs text-factory-dim">
        {gateStatusRaw}
      </pre>
    );
  }

  const { fields, steps, extra } = decoded;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries({ ...fields, ...extra }).map(([key, value]) => (
          <StateChip
            key={key}
            label={`${key}: ${value}`}
            tone={key === "status" ? toneForStepStatus(value) : "neutral"}
          />
        ))}
      </div>
      {steps.length > 0 && (
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-factory-border text-left text-factory-dim">
              <th className="py-1 pr-2 font-normal">step</th>
              <th className="py-1 pr-2 font-normal">status</th>
              <th className="py-1 pr-2 font-normal">findings</th>
              <th className="py-1 pr-2 font-normal">duration</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.step} className="border-b border-factory-border/50">
                <td className="py-1 pr-2 text-factory-text">{step.step}</td>
                <td className="py-1 pr-2">
                  <StateChip label={step.status} tone={toneForStepStatus(step.status)} />
                </td>
                <td className="py-1 pr-2 text-factory-dim">{step.findings}</td>
                <td className="py-1 pr-2 text-factory-dim">{formatDuration(step.durationMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
