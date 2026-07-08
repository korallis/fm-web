import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FleetSnapshot } from "@fm-web/shared";

const FLEET_QUERY_KEY = ["fleet"] as const;

async function fetchFleetSnapshot(): Promise<FleetSnapshot> {
  const res = await fetch("/api/fleet");
  if (!res.ok) throw new Error(`GET /api/fleet failed: ${res.status}`);
  return (await res.json()) as FleetSnapshot;
}

export interface FleetSnapshotState {
  snapshot: FleetSnapshot | undefined;
  isLoading: boolean;
  error: Error | null;
  wsConnected: boolean;
}

/** Initial fetch via TanStack Query; every chokidar-triggered WS push replaces the cached snapshot. */
export function useFleetSnapshot(): FleetSnapshotState {
  const queryClient = useQueryClient();
  const [wsConnected, setWsConnected] = useState(false);
  const query = useQuery({ queryKey: FLEET_QUERY_KEY, queryFn: fetchFleetSnapshot });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.addEventListener("open", () => setWsConnected(true));
    ws.addEventListener("close", () => setWsConnected(false));
    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data as string) as FleetSnapshot;
        queryClient.setQueryData(FLEET_QUERY_KEY, data);
      } catch {
        // ignore malformed frames
      }
    });

    return () => ws.close();
  }, [queryClient]);

  return {
    snapshot: query.data,
    isLoading: query.isLoading,
    error: query.error,
    wsConnected,
  };
}
