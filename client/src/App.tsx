import { useFleetSnapshot } from "./api/useFleetSnapshot";
import { FleetGrid } from "./components/FleetGrid";
import { BacklogLanes } from "./components/BacklogLanes";
import { SupervisionHealthStrip } from "./components/SupervisionHealthStrip";
import { ProjectModeChips } from "./components/ProjectModeChips";
import { DecisionsInbox } from "./components/DecisionsInbox";
import { WakeFeed } from "./components/WakeFeed";

export function App() {
  const { snapshot, isLoading, error, wsConnected } = useFleetSnapshot();

  return (
    <div className="min-h-screen bg-factory-bg px-4 py-6 text-factory-text">
      <header className="mb-6 flex items-center justify-between border-b border-factory-border pb-3">
        <h1 className="font-mono text-lg font-semibold text-factory-accent">FM Deck — Bridge</h1>
        <span className={`font-mono text-xs ${wsConnected ? "text-emerald-400" : "text-factory-dim"}`}>
          {wsConnected ? "● live" : "○ connecting…"}
        </span>
      </header>

      {isLoading && <p className="font-mono text-sm text-factory-dim">Loading fleet snapshot…</p>}
      {error !== null && <p className="font-mono text-sm text-red-400">Failed to load: {error.message}</p>}

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
            <FleetGrid tasks={snapshot.tasks} />
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
    </div>
  );
}
