import { useQuery } from "@tanstack/react-query";
import type { HomeEntry } from "@fm-web/shared";

export interface HomesResponse {
  /** The home id the app-owned Command Deck session is bound to - always `"primary"` today. */
  commandDeckHomeId: string;
  homes: HomeEntry[];
}

async function fetchHomes(): Promise<HomesResponse> {
  const res = await fetch("/api/homes");
  if (!res.ok) throw new Error(`GET /api/homes failed: ${res.status}`);
  return (await res.json()) as HomesResponse;
}

export const homesQueryKey = ["homes"] as const;

export function useHomes() {
  return useQuery({ queryKey: homesQueryKey, queryFn: fetchHomes });
}
