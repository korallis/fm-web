import type { SupervisionHealth } from "@fm-web/shared";
import { StateChip } from "./StateChip";

function formatAge(seconds: number | null): string {
  if (seconds === null) return "no beacon";
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function lockLabel(lock: SupervisionHealth["lock"]): string {
  if (lock.pid === null) return "lock: free";
  return lock.alive ? `lock: held (pid ${lock.pid})` : `lock: stale (pid ${lock.pid})`;
}

function lockTone(lock: SupervisionHealth["lock"]): "accent" | "neutral" | "warn" {
  if (lock.pid === null) return "neutral";
  return lock.alive ? "accent" : "warn";
}

export function SupervisionHealthStrip({ supervision }: { supervision: SupervisionHealth }) {
  const { lock, beaconAgeSeconds, beaconFresh, afk, timing } = supervision;
  return (
    <div className="flex flex-wrap items-center gap-2 border border-factory-border bg-factory-panel p-2">
      <StateChip label={lockLabel(lock)} tone={lockTone(lock)} />
      <StateChip
        label={`watcher beacon: ${formatAge(beaconAgeSeconds)}`}
        tone={beaconFresh ? "done" : "danger"}
      />
      <StateChip label={`guard grace: ${timing.guardGraceSeconds}s`} tone="neutral" />
      <StateChip label={`poll: ${timing.pollSeconds}s`} tone="neutral" />
      <StateChip
        label={`heartbeat: ${timing.heartbeatBaseSeconds}s→${timing.heartbeatMaxSeconds}s`}
        tone="neutral"
      />
      <StateChip label={`stale escalate: ${timing.staleEscalateSeconds}s`} tone="neutral" />
      {afk && <StateChip label="AFK active" tone="warn" />}
    </div>
  );
}
