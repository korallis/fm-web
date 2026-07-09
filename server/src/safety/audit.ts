import type { AuditLogEntry } from "@fm-web/shared";

/**
 * The advanced drawer's audit trail. In-memory only, capped, lost on restart.
 * ponytail: this app has no app-owned data dir yet and firstmate's own dirs are off-limits to
 * write (safety contract) - if a durable cross-restart trail is ever needed, add one write path
 * to a file outside fmHome, not before.
 */
const MAX_AUDIT_ENTRIES = 200;

let nextId = 0;
const entries: AuditLogEntry[] = [];

export interface RecordAuditInput {
  script: string;
  args: readonly string[];
  ok: boolean;
  summary: string;
}

export function recordAudit(input: RecordAuditInput, atMs: number = Date.now()): AuditLogEntry {
  nextId += 1;
  const entry: AuditLogEntry = {
    id: String(nextId),
    atMs,
    script: input.script,
    args: [...input.args],
    ok: input.ok,
    summary: input.summary,
  };
  entries.push(entry);
  if (entries.length > MAX_AUDIT_ENTRIES) entries.splice(0, entries.length - MAX_AUDIT_ENTRIES);
  return entry;
}

/** Newest first. */
export function listAudit(): AuditLogEntry[] {
  return [...entries].reverse();
}

/** Test-only reset so audit-log tests don't leak state across cases. */
export function clearAuditForTests(): void {
  entries.length = 0;
  nextId = 0;
}
