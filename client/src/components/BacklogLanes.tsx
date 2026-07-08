import type { ReactNode } from "react";
import type { Backlog, BacklogDoneTask, BacklogTask } from "@fm-web/shared";

function OpenItem({ task }: { task: BacklogTask }) {
  return (
    <li className="border border-factory-border bg-factory-panel p-2 font-mono text-xs">
      <div className="text-factory-text">{task.id}</div>
      <div className="text-factory-dim">{task.description}</div>
      {task.blockedBy !== undefined && (
        <div className="mt-1 text-amber-400">blocked-by: {task.blockedBy.id}</div>
      )}
    </li>
  );
}

function DoneItem({ task }: { task: BacklogDoneTask }) {
  return (
    <li className="border border-factory-border bg-factory-panel p-2 font-mono text-xs">
      <div className="text-factory-text">{task.id}</div>
      <div className="text-factory-dim">{task.description}</div>
    </li>
  );
}

function Lane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-mono text-xs uppercase tracking-wide text-factory-dim">{title}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

export function BacklogLanes({ backlog }: { backlog: Backlog }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Lane title={`In flight (${backlog.inFlight.length})`}>
        {backlog.inFlight.map((task) => (
          <OpenItem key={task.id} task={task} />
        ))}
      </Lane>
      <Lane title={`Queued (${backlog.queued.length})`}>
        {backlog.queued.map((task) => (
          <OpenItem key={task.id} task={task} />
        ))}
      </Lane>
      <Lane title={`Done (${backlog.done.length})`}>
        {backlog.done.map((task) => (
          <DoneItem key={task.id} task={task} />
        ))}
      </Lane>
    </div>
  );
}
