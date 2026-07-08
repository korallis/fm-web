import type { TimingConstants } from "@fm-web/shared";

/** Real defaults from firstmate's `docs/configuration.md`. Never invent different numbers. */
export const DEFAULT_TIMING: TimingConstants = {
  pollSeconds: 15,
  guardGraceSeconds: 300,
  heartbeatBaseSeconds: 600,
  heartbeatMaxSeconds: 7200,
  staleEscalateSeconds: 240,
  checkIntervalSeconds: 300,
};

function envInt(env: Record<string, string | undefined>, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Read timing constants from env, falling back to firstmate's documented defaults. */
export function loadTimingFromEnv(env: Record<string, string | undefined>): TimingConstants {
  return {
    pollSeconds: envInt(env, "FM_POLL", DEFAULT_TIMING.pollSeconds),
    guardGraceSeconds: envInt(env, "FM_GUARD_GRACE", DEFAULT_TIMING.guardGraceSeconds),
    heartbeatBaseSeconds: envInt(env, "FM_HEARTBEAT", DEFAULT_TIMING.heartbeatBaseSeconds),
    heartbeatMaxSeconds: envInt(env, "FM_HEARTBEAT_MAX", DEFAULT_TIMING.heartbeatMaxSeconds),
    staleEscalateSeconds: envInt(env, "FM_STALE_ESCALATE_SECS", DEFAULT_TIMING.staleEscalateSeconds),
    checkIntervalSeconds: envInt(env, "FM_CHECK_INTERVAL", DEFAULT_TIMING.checkIntervalSeconds),
  };
}
