import { useState } from "react";
import type { WakeEntry, WatchTriageEntry } from "@fm-web/shared";
import { StateChip, type ChipTone } from "./StateChip";

type FeedCategory = "surfaced" | "absorbed";
type FeedFilter = "all" | FeedCategory;

interface FeedRow {
  key: string;
  atMs: number | null;
  label: string;
  tone: ChipTone;
  text: string;
  category: FeedCategory;
}

function wakeRows(wakeQueue: readonly WakeEntry[]): FeedRow[] {
  return wakeQueue.map((entry, i) => ({
    key: `wake-${entry.seq}-${i}`,
    atMs: entry.epoch * 1000,
    label: `wake: ${entry.kind}`,
    tone: entry.kind === "signal" ? "accent" : "neutral",
    text: `${entry.key} — ${entry.payload}`,
    category: "surfaced",
  }));
}

function triageRows(watchTriage: readonly WatchTriageEntry[]): FeedRow[] {
  return watchTriage.map((entry, i) => ({
    key: `triage-${i}`,
    atMs: entry.timestampMs,
    label: "absorbed",
    tone: "neutral",
    text: entry.message,
    category: "absorbed",
  }));
}

function formatTime(atMs: number | null): string {
  return atMs === null ? "unknown time" : new Date(atMs).toLocaleTimeString();
}

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "surfaced", label: "Surfaced" },
  { id: "absorbed", label: "Absorbed" },
];

function countFor(filter: FeedFilter, surfaced: number, absorbed: number): number {
  if (filter === "surfaced") return surfaced;
  if (filter === "absorbed") return absorbed;
  return surfaced + absorbed;
}

/**
 * Read-only tail of `state/.wake-queue` (surfaced - escalated to firstmate) and
 * `state/.watch-triage.log` (absorbed - benign wakes the watcher classified away without
 * escalating, one line per wake via `fm-watch.sh`'s `triage_log()`), newest first. The
 * surfaced/absorbed filter shows how much noise the watcher is quietly filtering versus what
 * actually reached the captain.
 */
export function WakeFeed({
  wakeQueue,
  watchTriage,
}: {
  wakeQueue: readonly WakeEntry[];
  watchTriage: readonly WatchTriageEntry[];
}) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const surfaced = wakeRows(wakeQueue);
  const absorbed = triageRows(watchTriage);
  const rows = [...surfaced, ...absorbed]
    .filter((row) => filter === "all" || row.category === filter)
    .sort((a, b) => (b.atMs ?? 0) - (a.atMs ?? 0));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${
              filter === id
                ? "border-factory-accent text-factory-accent"
                : "border-factory-border text-factory-dim hover:text-factory-text"
            }`}
          >
            {label} ({countFor(id, surfaced.length, absorbed.length)})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="font-mono text-sm text-factory-dim">No wake activity recorded.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center gap-2 border border-factory-border bg-factory-panel px-2 py-1 font-mono text-xs"
            >
              <span className="shrink-0 text-factory-dim">{formatTime(row.atMs)}</span>
              <StateChip label={row.label} tone={row.tone} />
              <span className="truncate text-factory-text">{row.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
