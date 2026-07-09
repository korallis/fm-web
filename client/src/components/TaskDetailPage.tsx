import { useTaskDetail } from "../api/useTaskDetail";
import { useTaskPeek } from "../api/useTaskPeek";
import { StateChip } from "./StateChip";
import { toneForVerb } from "./chipTone";
import { StatusTimeline } from "./StatusTimeline";
import { BriefReport } from "./BriefReport";
import { PrStatusCard } from "./PrStatusCard";
import { GateFindingsPanel } from "./GateFindingsPanel";
import { CrewPeekTerminal } from "./CrewPeekTerminal";
import { UnstickLadder } from "./UnstickLadder";

export function TaskDetailPage({
  homeId,
  taskId,
  onBack,
}: {
  homeId: string;
  taskId: string;
  onBack: () => void;
}) {
  const { data: detail, isLoading, error } = useTaskDetail(homeId, taskId);
  const { data: peek, error: peekError } = useTaskPeek(homeId, taskId);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="w-fit font-mono text-xs text-factory-dim hover:text-factory-accent"
      >
        ← back to Bridge
      </button>

      {isLoading && <p className="font-mono text-sm text-factory-dim">Loading task {taskId}…</p>}
      {error !== null && error !== undefined && (
        <p className="font-mono text-sm text-red-400">Failed to load: {error.message}</p>
      )}

      {detail !== undefined && (
        <>
          <header className="flex flex-wrap items-center gap-2 border-b border-factory-border pb-3">
            <h1 className="font-mono text-lg font-semibold text-factory-accent">{detail.id}</h1>
            <StateChip
              label={`${detail.crewState.state} / ${detail.crewState.source}`}
              tone={toneForVerb(detail.crewState.state)}
            />
            <StateChip label={detail.meta.kind} tone="neutral" />
            {detail.crewState.detail !== "" && (
              <span className="font-mono text-xs text-factory-dim">{detail.crewState.detail}</span>
            )}
          </header>

          <section className="flex flex-col gap-2">
            <h2 className="font-mono text-xs uppercase tracking-wide text-factory-dim">Live crew terminal</h2>
            <CrewPeekTerminal text={peek?.text} />
            {peekError !== null && peekError !== undefined && (
              <p className="font-mono text-xs text-red-400">Live terminal failed: {peekError.message}</p>
            )}
            <UnstickLadder homeId={homeId} taskId={taskId} />
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">
              Brief &amp; report
            </h2>
            <BriefReport brief={detail.brief} report={detail.report} />
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">
              PR &amp; merge-poll status
            </h2>
            <PrStatusCard pr={detail.pr} />
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">
              no-mistakes gate findings
            </h2>
            <GateFindingsPanel gateStatusRaw={detail.gateStatusRaw} />
          </section>

          <section>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">
              Status timeline
            </h2>
            <StatusTimeline history={detail.statusHistory} />
          </section>
        </>
      )}
    </div>
  );
}
