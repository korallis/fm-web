import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { HomeEntry } from "@fm-web/shared";
import { connectWithBackoff } from "./wsReconnect";

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
  const queryClient = useQueryClient();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?home=primary`;

    const refreshHomes = (): void => {
      void queryClient.invalidateQueries({ queryKey: homesQueryKey });
    };

    return connectWithBackoff(url, {
      onOpen: refreshHomes,
      onMessage: refreshHomes,
    });
  }, [queryClient]);

  return useQuery({ queryKey: homesQueryKey, queryFn: fetchHomes });
}
