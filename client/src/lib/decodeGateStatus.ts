import { decode } from "@toon-format/toon";

export interface GateStep {
  step: string;
  status: string;
  findings: number | string;
  durationMs: number | string | undefined;
}

export interface DecodedGateStatus {
  /** Fields lifted from the `run:` block (or the top level, if a future format flattens it). */
  fields: Record<string, string>;
  /** The `run.steps[N]{...}` table, when present. */
  steps: GateStep[];
  /** Everything else at the top level (e.g. `outcome:`), for a generic key/value display. */
  extra: Record<string, string>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function extractSteps(run: Record<string, unknown> | null): GateStep[] {
  const raw = run?.["steps"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map(asRecord)
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      step: toDisplayString(row["step"]),
      status: toDisplayString(row["status"]),
      findings: (row["findings"] as number | string | undefined) ?? "",
      durationMs: row["duration_ms"] as number | string | undefined,
    }));
}

function scalarFields(
  record: Record<string, unknown> | null,
  skip: readonly string[] = [],
): Record<string, string> {
  if (record === null) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (skip.includes(key)) continue;
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) continue;
    out[key] = toDisplayString(value);
  }
  return out;
}

/**
 * Decode raw `no-mistakes axi status` TOON (see `TaskDetail.gateStatusRaw`) into a display-ready
 * shape. Returns null on malformed/unrecognized input so the caller can fall back to a raw-text
 * view — this mirrors the adapter's own defensive "pass unknown shapes through" philosophy rather
 * than throwing on a format this app doesn't fully model yet.
 */
export function decodeGateStatus(raw: string): DecodedGateStatus | null {
  try {
    const decoded = decode(raw, { strict: false });
    const top = asRecord(decoded);
    if (top === null) return null;
    const run = asRecord(top["run"]) ?? top;
    return {
      fields: scalarFields(run, ["steps"]),
      steps: extractSteps(run),
      extra: scalarFields(top, ["run"]),
    };
  } catch {
    return null;
  }
}
