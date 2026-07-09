import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface CrewPeekTerminalProps {
  text: string | undefined;
}

/** Read-only xterm.js mirror of a crew's OWN session via periodic `fm-peek.sh` polling - unlike
 * the app-owned session's pane stream there's no per-crew chunk feed, so every poll re-renders
 * the whole snapshot instead of appending. */
export function CrewPeekTerminal({ text }: CrewPeekTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const term = new Terminal({
      convertEol: true,
      disableStdin: true,
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: 13,
      theme: { background: "#020202", foreground: "#e8e8e8", cursor: "#ef6f2e" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();
    termRef.current = term;

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (text === undefined) return;
    const term = termRef.current;
    if (term === undefined) return;
    term.reset();
    term.write(text);
  }, [text]);

  return <div ref={containerRef} className="h-[20rem] border border-factory-border bg-factory-bg p-1" />;
}
