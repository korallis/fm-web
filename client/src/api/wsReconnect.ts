const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

export interface WsReconnectHandlers {
  onOpen?: (ws: WebSocket) => void;
  onMessage: (data: string) => void;
  onStatusChange?: (connected: boolean) => void;
}

/** Small reconnect-with-backoff wrapper shared by the fleet snapshot socket and the session socket. */
export function connectWithBackoff(url: string, handlers: WsReconnectHandlers): () => void {
  let ws: WebSocket | undefined;
  let reconnectTimer: number | undefined;
  let reconnectAttempt = 0;
  let stopped = false;

  const connect = (): void => {
    const socket = new WebSocket(url);
    ws = socket;

    socket.addEventListener("open", () => {
      reconnectAttempt = 0;
      handlers.onStatusChange?.(true);
      handlers.onOpen?.(socket);
    });
    socket.addEventListener("close", () => {
      if (stopped) return;
      handlers.onStatusChange?.(false);
      const delayMs = Math.min(INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(connect, delayMs);
    });
    socket.addEventListener("error", () => socket.close());
    socket.addEventListener("message", (event) => handlers.onMessage(event.data as string));
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    ws?.close();
  };
}
