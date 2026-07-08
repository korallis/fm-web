import type { WakeEntry, WakeKind } from "@fm-web/shared";

const WAKE_KINDS: readonly WakeKind[] = ["signal", "stale", "check", "heartbeat"];

function isWakeKind(value: string): value is WakeKind {
  return (WAKE_KINDS as readonly string[]).includes(value);
}

/**
 * Parse `state/.wake-queue` — tab-separated `epoch\tseq\tkind\tkey\tpayload` lines.
 * Malformed lines and unrecognized `kind` values are dropped defensively (the writer,
 * `fm_wake_append` in fm-wake-lib.sh, enforces the kind enum, so this should not happen
 * in practice).
 */
export function parseWakeQueue(content: string): WakeEntry[] {
  const entries: WakeEntry[] = [];
  for (const line of content.split("\n")) {
    if (line.trim() === "") continue;
    const fields = line.split("\t");
    if (fields.length !== 5) continue;
    const [epochRaw, seqRaw, kindRaw, key, payload] = fields as [string, string, string, string, string];
    const epoch = Number(epochRaw);
    const seq = Number(seqRaw);
    if (!Number.isFinite(epoch) || !Number.isFinite(seq) || !isWakeKind(kindRaw)) continue;
    entries.push({ epoch, seq, kind: kindRaw, key, payload });
  }
  return entries;
}
