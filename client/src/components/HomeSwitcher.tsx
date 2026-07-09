import type { HomeEntry } from "@fm-web/shared";

export interface HomeSwitcherProps {
  homes: readonly HomeEntry[];
  selectedHomeId: string;
  onSelect: (homeId: string) => void;
}

/** Switches which discovered firstmate home the Bridge/task-detail views read - the app-owned
 * Command Deck session always stays bound to the booted primary home (see AGENTS.md). */
export function HomeSwitcher({ homes, selectedHomeId, onSelect }: HomeSwitcherProps) {
  if (homes.length <= 1) return null;
  const selected = homes.find((home) => home.id === selectedHomeId);

  return (
    <label className="flex items-center gap-1.5 font-mono text-xs text-factory-dim" title={selected?.path}>
      viewing
      <select
        value={selectedHomeId}
        onChange={(event) => onSelect(event.target.value)}
        className="border border-factory-border bg-factory-panel px-1.5 py-0.5 font-mono text-xs text-factory-text"
      >
        {homes.map((home) => (
          <option key={home.id} value={home.id}>
            {home.label}
          </option>
        ))}
      </select>
    </label>
  );
}
