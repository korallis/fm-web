import type { FleetTask } from "@fm-web/shared";
import { StateChip } from "./StateChip";
import { toneForVerb } from "./chipTone";

function TaskCard({ task }: { task: FleetTask }) {
  const state = task.crewState.state;
  return (
    <div className="flex flex-col gap-2 border border-factory-border bg-factory-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-factory-text">{task.id}</span>
        <StateChip label={`${state} / ${task.crewState.source}`} tone={toneForVerb(state)} />
      </div>
      <div className="flex flex-wrap gap-1">
        <StateChip label={task.meta.kind} tone="neutral" />
        {task.meta.harness !== undefined && <StateChip label={task.meta.harness} tone="neutral" />}
        {task.meta.backend !== undefined && <StateChip label={task.meta.backend} tone="neutral" />}
        <StateChip
          label={task.worktreePresent ? "worktree: present" : "worktree: gone"}
          tone={task.worktreePresent ? "done" : "danger"}
        />
        {task.captainRelevant && <StateChip label="needs captain" tone="accent" />}
      </div>
      {task.latestStatus !== null && (
        <p className="line-clamp-3 font-mono text-xs text-factory-dim">latest log: {task.latestStatus.raw}</p>
      )}
    </div>
  );
}

export function FleetGrid({ tasks }: { tasks: readonly FleetTask[] }) {
  if (tasks.length === 0) {
    return <p className="font-mono text-sm text-factory-dim">No spawned tasks in state/.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
