import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  commands: readonly PaletteCommand[];
  onClose: () => void;
}

/** Cmd+K / Ctrl+K palette: a filterable, keyboard-navigable list of cross-cutting actions
 * (tab switch, home switch, open task, interrupt session) - see `useCommandPaletteHotkey`. */
export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return commands;
    return commands.filter(
      (command) => command.label.toLowerCase().includes(q) || command.hint?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(Math.max(i, 0), Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  if (!open) return null;

  const runActive = (): void => {
    const command = filtered[activeIndex];
    if (command === undefined) return;
    onClose();
    command.run();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runActive();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24" onClick={onClose}>
      <div
        className="flex w-full max-w-lg flex-col border border-factory-border bg-factory-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command…"
          aria-label="Command palette"
          className="border-b border-factory-border bg-transparent p-3 font-mono text-sm text-factory-text placeholder:text-factory-dim focus:outline-none"
        />
        <ul className="max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="px-3 py-2 font-mono text-xs text-factory-dim">No matching commands.</li>
          )}
          {filtered.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onClose();
                  command.run();
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-mono text-xs ${
                  i === activeIndex ? "bg-factory-bg text-factory-accent" : "text-factory-text"
                }`}
              >
                <span className="shrink-0 whitespace-nowrap">{command.label}</span>
                {command.hint !== undefined && (
                  <span className="min-w-0 flex-1 truncate text-right text-factory-dim">{command.hint}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
