import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FleetSnapshot } from "@fm-web/shared";
import { taskDetailQueryKey } from "./useTaskDetail";
import { homesQueryKey } from "./useHomes";
import { connectWithBackoff } from "./wsReconnect";

function fleetQueryKey(homeId: string): readonly ["fleet", string] {
  return ["fleet", homeId] as const;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function fetchFleetSnapshot(homeId: string): Promise<FleetSnapshot> {
  const res = await fetch(`/api/fleet?home=${encodeURIComponent(homeId)}`);
  if (!res.ok) throw new HttpError(res.status, `GET /api/fleet failed: ${res.status}`);
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

/** Initial fetch via TanStack Query; every chokidar-triggered WS push replaces the cached snapshot.
 * `homeId` selects which discovered firstmate home to read (see `useHomes`/`useSelectedHomeId`). */
export function useFleetSnapshot(homeId: string, activeTaskId: string | null = null): FleetSnapshotState {
  const queryClient = useQueryClient();
  const activeTaskIdRef = useRef(activeTaskId);
  const [wsConnected, setWsConnected] = useState(false);
  const queryKey = fleetQueryKey(homeId);
  const query = useQuery({
    queryKey,
    queryFn: () => fetchFleetSnapshot(homeId),
    structuralSharing: (current, incoming) =>
      preferNewestSnapshot(current as FleetSnapshot | undefined, incoming as FleetSnapshot),
  });

  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);

  useEffect(() => {
    if (query.error instanceof HttpError && query.error.status === 400)
      void queryClient.invalidateQueries({ queryKey: homesQueryKey });
  }, [query.error, queryClient]);

  useEffect(() => {
    const liveQueryKey = fleetQueryKey(homeId);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?home=${encodeURIComponent(homeId)}`;

    const invalidateActiveTask = (): void => {
      const id = activeTaskIdRef.current;
      if (id !== null) void queryClient.invalidateQueries({ queryKey: taskDetailQueryKey(homeId, id) });
    };

    return connectWithBackoff(url, {
      onStatusChange: setWsConnected,
      onOpen: () => {
        void queryClient.invalidateQueries({ queryKey: homesQueryKey });
        void queryClient.invalidateQueries({ queryKey: liveQueryKey });
        invalidateActiveTask();
      },
      onMessage: (data) => {
        try {
          const parsed = JSON.parse(data) as FleetSnapshot;
          void queryClient.invalidateQueries({ queryKey: homesQueryKey });
          queryClient.setQueryData<FleetSnapshot>(liveQueryKey, (current) =>
            preferNewestSnapshot(current, parsed),
          );
          invalidateActiveTask();
        } catch {
          // ignore malformed frames
        }
      },
    });
  }, [queryClient, homeId]);

  return {
    snapshot: query.data,
    isLoading: query.isLoading,
    error: query.error,
    wsConnected,
  };
}
