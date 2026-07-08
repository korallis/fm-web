import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ComposerState, SessionWsMessage } from "@fm-web/shared";
import { connectWithBackoff } from "./wsReconnect";

const COMPOSER_STATE_QUERY_KEY = ["composerState"] as const;

export interface TerminalMessage {
  type: "snapshot" | "chunk";
  text: string;
}
export type TerminalListener = (message: TerminalMessage) => void;

async function fetchComposerState(): Promise<ComposerState> {
  const res = await fetch("/api/composer/state");
  if (!res.ok) throw new Error(`GET /api/composer/state failed: ${res.status}`);
  return (await res.json()) as ComposerState;
}

export interface SessionSocketState {
  composerState: ComposerState | undefined;
  wsConnected: boolean;
  subscribeTerminal: (listener: TerminalListener) => () => void;
}

/** Owns the single `/ws/session` connection: composer state (busy/lock/queue) and the raw
 * terminal snapshot/chunk stream for `ResponseTerminal` both flow through here. */
export function useSessionSocket(): SessionSocketState {
  const [composerState, setComposerState] = useState<ComposerState>();
  const [wsConnected, setWsConnected] = useState(false);
  const listenersRef = useRef(new Set<TerminalListener>());
  const initialQuery = useQuery({ queryKey: COMPOSER_STATE_QUERY_KEY, queryFn: fetchComposerState });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/session`;
    return connectWithBackoff(url, {
      onStatusChange: setWsConnected,
      onMessage: (data) => {
        let message: SessionWsMessage;
        try {
          message = JSON.parse(data) as SessionWsMessage;
        } catch {
          return;
        }
        if (message.type === "composerState") {
          setComposerState(message.state);
        } else {
          for (const listener of listenersRef.current) listener(message);
        }
      },
    });
  }, []);

  const subscribeTerminal = useCallback((listener: TerminalListener): (() => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return { composerState: composerState ?? initialQuery.data, wsConnected, subscribeTerminal };
}
