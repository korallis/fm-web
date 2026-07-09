import type { FleetTask } from "@fm-web/shared";
import { StateChip } from "./StateChip";
import { toneForVerb } from "./chipTone";

function TaskCard({ task, onOpenTask }: { task: FleetTask; onOpenTask: (id: string) => void }) {
  const state = task.crewState.state;
  return (
    <div className="flex flex-col gap-2 border border-factory-border bg-factory-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenTask(task.id)}
          className="font-mono text-sm text-factory-text underline-offset-2 hover:text-factory-accent hover:underline"
        >
          {task.id}
        </button>
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

export function FleetGrid({
  tasks,
  onOpenTask,
}: {
  tasks: readonly FleetTask[];
  onOpenTask: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return <p className="font-mono text-sm text-factory-dim">No spawned tasks in state/.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onOpenTask={onOpenTask} />
      ))}
    </div>
  );
}
