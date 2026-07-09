import { useState } from "react";
import { useFleetSnapshot, type FleetSnapshotState } from "./api/useFleetSnapshot";
import { useHomes, type HomesResponse } from "./api/useHomes";
import { interruptSession } from "./api/useComposerSend";
import { FleetGrid } from "./components/FleetGrid";
import { BacklogLanes } from "./components/BacklogLanes";
import { SupervisionHealthStrip } from "./components/SupervisionHealthStrip";
import { ProjectModeChips } from "./components/ProjectModeChips";
import { DecisionsInbox } from "./components/DecisionsInbox";
import { WakeFeed } from "./components/WakeFeed";
import { SecondmatePanel } from "./components/SecondmatePanel";
import { XModePanel } from "./components/XModePanel";
import { TaskDetailPage } from "./components/TaskDetailPage";
import { CommandDeck } from "./components/CommandDeck";
import { HomeSwitcher } from "./components/HomeSwitcher";
import { useTaskRoute } from "./routing/useTaskRoute";
import { useSelectedHomeId } from "./routing/useSelectedHome";
import { useCaptainNotifications } from "./notifications/useCaptainNotifications";
import { ToastStack } from "./notifications/ToastStack";
import { NotificationBell } from "./notifications/NotificationBell";
import { CommandPalette, type PaletteCommand } from "./palette/CommandPalette";
import { useCommandPaletteHotkey } from "./palette/useCommandPaletteHotkey";
import type { FleetSnapshot } from "@fm-web/shared";

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
  homeId,
  onSelectHome,
  homes,
  notifyPermission,
  onRequestNotify,
  onOpenPalette,
}: {
  fleet: FleetSnapshotState;
  tab: Tab;
  onSelectTab: (tab: Tab) => void;
  onOpenTask: (id: string) => void;
  homeId: string;
  onSelectHome: (id: string) => void;
  homes: HomesResponse | undefined;
  notifyPermission: NotificationPermission | "unsupported";
  onRequestNotify: () => void;
  onOpenPalette: () => void;
}) {
  const { snapshot, isLoading, error, wsConnected } = fleet;
  const commandDeckHome = homes?.homes.find((home) => home.id === homes.commandDeckHomeId)?.path;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-factory-border pb-3">
        <div className="flex flex-wrap items-center gap-6">
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
          {homes !== undefined && (
            <HomeSwitcher homes={homes.homes} selectedHomeId={homeId} onSelect={onSelectHome} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPalette}
            className="border border-factory-border px-2 py-0.5 font-mono text-[11px] text-factory-dim hover:border-factory-accent hover:text-factory-accent"
          >
            Cmd+K
          </button>
          <NotificationBell permission={notifyPermission} onRequest={onRequestNotify} />
          <span className={`font-mono text-xs ${wsConnected ? "text-emerald-400" : "text-factory-dim"}`}>
            {wsConnected ? "● live" : "○ connecting…"}
          </span>
        </div>
      </header>

      {tab === "deck" && <CommandDeck fmHome={commandDeckHome} />}

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

              <section>
                <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">
                  Secondmates ({snapshot.secondmates.length})
                </h2>
                <SecondmatePanel secondmates={snapshot.secondmates} />
              </section>

              <section>
                <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-factory-dim">X mode</h2>
                <XModePanel tasks={snapshot.tasks} />
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}

function buildPaletteCommands(options: {
  homes: HomesResponse | undefined;
  snapshot: FleetSnapshot | undefined;
  notifyPermission: NotificationPermission | "unsupported";
  onRequestNotify: () => void;
  onSelectTab: (tab: Tab) => void;
  onSelectHome: (id: string) => void;
  onOpenTask: (id: string) => void;
}): PaletteCommand[] {
  const { homes, snapshot, notifyPermission, onRequestNotify, onSelectTab, onSelectHome, onOpenTask } =
    options;
  const commands: PaletteCommand[] = [
    { id: "tab-deck", label: "Go to Command Deck", run: () => onSelectTab("deck") },
    { id: "tab-bridge", label: "Go to Bridge", run: () => onSelectTab("bridge") },
    { id: "interrupt", label: "Interrupt session (Ctrl+C)", run: () => void interruptSession() },
  ];
  if (notifyPermission === "default") {
    commands.push({ id: "notify", label: "Enable notifications", run: onRequestNotify });
  }
  for (const home of homes?.homes ?? []) {
    commands.push({
      id: `home-${home.id}`,
      label: `Switch home: ${home.label}`,
      hint: home.path,
      run: () => onSelectHome(home.id),
    });
  }
  for (const task of snapshot?.tasks ?? []) {
    commands.push({
      id: `task-${task.id}`,
      label: `Open task: ${task.id}`,
      hint: task.crewState.state,
      run: () => onOpenTask(task.id),
    });
  }
  return commands;
}

export function App() {
  const { taskId, openTask, closeTask } = useTaskRoute();
  const [homeId, setHomeId] = useSelectedHomeId();
  const fleet = useFleetSnapshot(homeId, taskId);
  const homes = useHomes();
  const [tab, setTab] = useState<Tab>("deck");
  const notifications = useCaptainNotifications(homeId, fleet.snapshot?.decisions);
  const [paletteOpen, setPaletteOpen] = useCommandPaletteHotkey();

  const openTaskFromBridge = (id: string): void => {
    setTab("bridge");
    openTask(id);
  };

  const closeTaskToBridge = (): void => {
    setTab("bridge");
    closeTask();
  };

  const paletteCommands = buildPaletteCommands({
    homes: homes.data,
    snapshot: fleet.snapshot,
    notifyPermission: notifications.permission,
    onRequestNotify: notifications.requestPermission,
    onSelectTab: setTab,
    onSelectHome: setHomeId,
    onOpenTask: openTaskFromBridge,
  });

  return (
    <div className="min-h-screen bg-factory-bg px-4 py-6 text-factory-text">
      <ToastStack toasts={notifications.toasts} onDismiss={notifications.dismissToast} />
      <CommandPalette open={paletteOpen} commands={paletteCommands} onClose={() => setPaletteOpen(false)} />
      {taskId !== null ? (
        <TaskDetailPage homeId={homeId} taskId={taskId} onBack={closeTaskToBridge} />
      ) : (
        <Bridge
          fleet={fleet}
          tab={tab}
          onSelectTab={setTab}
          onOpenTask={openTaskFromBridge}
          homeId={homeId}
          onSelectHome={setHomeId}
          homes={homes.data}
          notifyPermission={notifications.permission}
          onRequestNotify={notifications.requestPermission}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}
    </div>
  );
}
