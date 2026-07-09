import { useState } from "react";
import { useFleetSnapshot, type FleetSnapshotState } from "./api/useFleetSnapshot";
import { FleetGrid } from "./components/FleetGrid";
import { BacklogLanes } from "./components/BacklogLanes";
import { SupervisionHealthStrip } from "./components/SupervisionHealthStrip";
import { ProjectModeChips } from "./components/ProjectModeChips";
import { DecisionsInbox } from "./components/DecisionsInbox";
import { WakeFeed } from "./components/WakeFeed";
import { TaskDetailPage } from "./components/TaskDetailPage";
import { CommandDeck } from "./components/CommandDeck";
import { useTaskRoute } from "./routing/useTaskRoute";

type Tab = "deck" | "bridge";

const TABS: { id: Tab; label: string }[] = [
  { id: "deck", label: "Command Deck" },
  { id: "bridge", label: "Bridge" },
];

function Bridge({
  fleet,
  tab,
  onSelectTab,
  onOpenTask,
}: {
  fleet: FleetSnapshotState;
  tab: Tab;
  onSelectTab: (tab: Tab) => void;
  onOpenTask: (id: string) => void;
}) {
  const { snapshot, isLoading, error, wsConnected } = fleet;

  return (
    <>
      <header className="mb-6 flex items-center justify-between border-b border-factory-border pb-3">
        <div className="flex items-center gap-6">
          <h1 className="font-mono text-lg font-semibold text-factory-accent">FM Deck</h1>
          <nav className="flex gap-1">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`border px-3 py-1 font-mono text-xs uppercase tracking-wide ${
                  tab === id
                    ? "border-factory-accent text-factory-accent"
                    : "border-factory-border text-factory-dim hover:text-factory-text"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <span className={`font-mono text-xs ${wsConnected ? "text-emerald-400" : "text-factory-dim"}`}>
          {wsConnected ? "● live" : "○ connecting…"}
        </span>
      </header>

      {tab === "deck" && <CommandDeck fmHome={snapshot?.fmHome} />}

      {tab === "bridge" && (
        <>
          {isLoading && <p className="font-mono text-sm text-factory-dim">Loading fleet snapshot…</p>}
          {error !== null && (
            <p className="font-mono text-sm text-red-400">Failed to load: {error.message}</p>
          )}

          {snapshot !== undefined && (
            <div className="flex flex-col gap-8">
              <section>
                <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">
                  Supervision health
                </h2>
                <SupervisionHealthStrip supervision={snapshot.supervision} />
              </section>

              <section>
                <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">
                  Decisions ({snapshot.decisions.length})
                </h2>
                <DecisionsInbox decisions={snapshot.decisions} />
              </section>

              <section>
                <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">Fleet</h2>
                <FleetGrid tasks={snapshot.tasks} onOpenTask={onOpenTask} />
              </section>

              <section>
                <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">Backlog</h2>
                <BacklogLanes backlog={snapshot.backlog} />
              </section>

              <section>
                <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">Wake feed</h2>
                <WakeFeed wakeQueue={snapshot.wakeQueue} watchTriage={snapshot.watchTriage} />
              </section>

              <section>
                <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">Projects</h2>
                <ProjectModeChips projects={snapshot.projects} />
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function App() {
  const { taskId, openTask, closeTask } = useTaskRoute();
  const fleet = useFleetSnapshot(taskId);
  const [tab, setTab] = useState<Tab>("deck");

  const openTaskFromBridge = (id: string): void => {
    setTab("bridge");
    openTask(id);
  };

  const closeTaskToBridge = (): void => {
    setTab("bridge");
    closeTask();
  };

  return (
    <div className="min-h-screen bg-factory-bg px-4 py-6 text-factory-text">
      {taskId !== null ? (
        <TaskDetailPage taskId={taskId} onBack={closeTaskToBridge} />
      ) : (
        <Bridge fleet={fleet} tab={tab} onSelectTab={setTab} onOpenTask={openTaskFromBridge} />
      )}
    </div>
  );
}
