import { resolve } from "node:path";
import type { HomeEntry } from "@fm-web/shared";
import { secondmatesPath } from "./paths.js";
import { parseSecondmates } from "./secondmates.js";
import { readIfExists } from "./fleetState.js";

/**
 * Discoverable firstmate homes: the booted primary plus every registered secondmate home from
 * `data/secondmates.md` (already parsed read-only elsewhere in the adapter) - no separate homes
 * registry to invent or maintain. Read-only; never writes `secondmates.md`.
 */
export function discoverHomes(bootFmHome: string): HomeEntry[] {
  const primaryPath = resolve(bootFmHome);
  const homes: HomeEntry[] = [{ id: "primary", path: primaryPath, label: "primary" }];
  const seen = new Set([primaryPath]);

  const content = readIfExists(secondmatesPath(bootFmHome));
  const secondmates = content === null ? [] : parseSecondmates(content);
  for (const secondmate of secondmates) {
    const path = resolve(secondmate.home);
    if (seen.has(path)) continue;
    seen.add(path);
    homes.push({ id: secondmate.id, path, label: secondmate.id });
  }
  return homes;
}

/** Resolve a `?home=` id to its filesystem path; `undefined`/`"primary"` means the booted home. */
export function resolveHomeId(bootFmHome: string, homeId: string | undefined): string | null {
  if (homeId === undefined || homeId === "primary") return bootFmHome;
  return discoverHomes(bootFmHome).find((home) => home.id === homeId)?.path ?? null;
}
