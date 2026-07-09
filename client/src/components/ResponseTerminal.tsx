import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { TerminalListener } from "../api/useSessionSocket";

export interface ResponseTerminalProps {
  subscribeTerminal: (listener: TerminalListener) => () => void;
}

/** Read-mostly xterm.js mirror of the app-owned session's pane - the composer is the one place
 * that steers it; this just shows what's happening. */
export function ResponseTerminal({ subscribeTerminal }: ResponseTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const term = new Terminal({
      convertEol: true,
      disableStdin: true,
      // A variable-width font (Geist Mono Variable) throws off xterm's fixed-cell glyph
      // measurement, spacing characters unevenly - the terminal needs a true fixed-width metric.
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: 13,
      theme: {
        background: "#020202",
        foreground: "#e8e8e8",
        cursor: "#ef6f2e",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(container);

    const unsubscribe = subscribeTerminal((message) => {
      if (message.type === "snapshot") term.reset();
      term.write(message.text);
    });

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [subscribeTerminal]);

  return <div ref={containerRef} className="h-[26rem] border border-factory-border bg-factory-bg p-1" />;
}
