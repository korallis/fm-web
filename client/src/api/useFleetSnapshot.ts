import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FleetSnapshot } from "@fm-web/shared";
import { taskDetailQueryKey } from "./useTaskDetail";
import { connectWithBackoff } from "./wsReconnect";

const FLEET_QUERY_KEY = ["fleet"] as const;

async function fetchFleetSnapshot(): Promise<FleetSnapshot> {
  const res = await fetch("/api/fleet");
  if (!res.ok) throw new Error(`GET /api/fleet failed: ${res.status}`);
  return (await res.json()) as FleetSnapshot;
}

export function preferNewestSnapshot(
  current: FleetSnapshot | undefined,
  incoming: FleetSnapshot,
): FleetSnapshot {
  return current !== undefined && current.generatedAtMs > incoming.generatedAtMs ? current : incoming;
}

export interface FleetSnapshotState {
  snapshot: FleetSnapshot | undefined;
  isLoading: boolean;
  error: Error | null;
  wsConnected: boolean;
}

/** Initial fetch via TanStack Query; every chokidar-triggered WS push replaces the cached snapshot. */
export function useFleetSnapshot(activeTaskId: string | null = null): FleetSnapshotState {
  const queryClient = useQueryClient();
  const activeTaskIdRef = useRef(activeTaskId);
  const [wsConnected, setWsConnected] = useState(false);
  const query = useQuery({
    queryKey: FLEET_QUERY_KEY,
    queryFn: fetchFleetSnapshot,
    structuralSharing: (current, incoming) =>
      preferNewestSnapshot(current as FleetSnapshot | undefined, incoming as FleetSnapshot),
  });

  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

    const invalidateActiveTask = (): void => {
      const id = activeTaskIdRef.current;
      if (id !== null) void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(id) });
    };

    return connectWithBackoff(url, {
      onStatusChange: setWsConnected,
      onOpen: () => {
        void queryClient.invalidateQueries({ queryKey: FLEET_QUERY_KEY });
        invalidateActiveTask();
      },
      onMessage: (data) => {
        try {
          const parsed = JSON.parse(data) as FleetSnapshot;
          queryClient.setQueryData<FleetSnapshot>(FLEET_QUERY_KEY, (current) =>
            preferNewestSnapshot(current, parsed),
          );
          invalidateActiveTask();
        } catch {
          // ignore malformed frames
        }
      },
    });
  }, [queryClient]);

  return {
    snapshot: query.data,
    isLoading: query.isLoading,
    error: query.error,
    wsConnected,
  };
}
