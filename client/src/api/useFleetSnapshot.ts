import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FleetSnapshot } from "@fm-web/shared";

const FLEET_QUERY_KEY = ["fleet"] as const;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

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
export function useFleetSnapshot(): FleetSnapshotState {
  const queryClient = useQueryClient();
  const [wsConnected, setWsConnected] = useState(false);
  const query = useQuery({
    queryKey: FLEET_QUERY_KEY,
    queryFn: fetchFleetSnapshot,
    structuralSharing: (current, incoming) =>
      preferNewestSnapshot(current as FleetSnapshot | undefined, incoming as FleetSnapshot),
  });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let reconnectAttempt = 0;
    let stopped = false;

    const connect = () => {
      const socket = new WebSocket(url);
      ws = socket;

      socket.addEventListener("open", () => {
        if (stopped) {
          socket.close();
          return;
        }
        reconnectAttempt = 0;
        setWsConnected(true);
        void queryClient.invalidateQueries({ queryKey: FLEET_QUERY_KEY });
      });
      socket.addEventListener("close", () => {
        if (stopped) return;
        setWsConnected(false);
        const delayMs = Math.min(INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delayMs);
      });
      socket.addEventListener("error", () => {
        if (socket.readyState === WebSocket.OPEN) socket.close();
      });
      socket.addEventListener("message", (event) => {
        if (stopped) return;
        try {
          const data = JSON.parse(event.data as string) as FleetSnapshot;
          queryClient.setQueryData<FleetSnapshot>(FLEET_QUERY_KEY, (current) =>
            preferNewestSnapshot(current, data),
          );
        } catch {
          // ignore malformed frames
        }
      });
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (ws?.readyState === WebSocket.OPEN) ws.close();
    };
  }, [queryClient]);

  return {
    snapshot: query.data,
    isLoading: query.isLoading,
    error: query.error,
    wsConnected,
  };
}
