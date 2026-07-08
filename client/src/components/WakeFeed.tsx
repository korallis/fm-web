import type { WakeEntry, WatchTriageEntry } from "@fm-web/shared";
import { StateChip, type ChipTone } from "./StateChip";

interface FeedRow {
  key: string;
  atMs: number | null;
  label: string;
  tone: ChipTone;
  text: string;
}

function wakeRows(wakeQueue: readonly WakeEntry[]): FeedRow[] {
  return wakeQueue.map((entry, i) => ({
    key: `wake-${entry.seq}-${i}`,
    atMs: entry.epoch * 1000,
    label: `wake: ${entry.kind}`,
    tone: entry.kind === "signal" ? "accent" : "neutral",
    text: `${entry.key} — ${entry.payload}`,
  }));
}

function triageRows(watchTriage: readonly WatchTriageEntry[]): FeedRow[] {
  return watchTriage.map((entry, i) => ({
    key: `triage-${i}`,
    atMs: entry.timestampMs,
    label: "triage",
    tone: "neutral",
    text: entry.message,
  }));
}

function formatTime(atMs: number | null): string {
  return atMs === null ? "unknown time" : new Date(atMs).toLocaleTimeString();
}

/** Read-only tail of `state/.wake-queue` + `state/.watch-triage.log`, newest first. */
export function WakeFeed({
  wakeQueue,
  watchTriage,
}: {
  wakeQueue: readonly WakeEntry[];
  watchTriage: readonly WatchTriageEntry[];
}) {
  const rows = [...wakeRows(wakeQueue), ...triageRows(watchTriage)].sort(
    (a, b) => (b.atMs ?? 0) - (a.atMs ?? 0),
  );

  if (rows.length === 0) {
    return <p className="font-mono text-sm text-factory-dim">No wake activity recorded.</p>;
  }

  return (
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
  );
}
