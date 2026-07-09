import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskInterrupt, useTaskSteer } from "../api/useTaskSend";
import { taskPeekQueryKey } from "../api/useTaskPeek";

const INTERRUPT_ARM_TIMEOUT_MS = 4000;

/** The unstick ladder's steer + interrupt rungs (peek is the live terminal above this). Both are
 * guarded actions against `fm-send.sh` targeting the crew's OWN session - never the app-owned
 * composer queue. */
export function UnstickLadder({ homeId, taskId }: { homeId: string; taskId: string }) {
  const [steerText, setSteerText] = useState("");
  const [armed, setArmed] = useState(false);
  const steer = useTaskSteer(homeId, taskId);
  const interrupt = useTaskInterrupt(homeId, taskId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), INTERRUPT_ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const refreshPeek = (): void => {
    void queryClient.invalidateQueries({ queryKey: taskPeekQueryKey(homeId, taskId) });
  };

  const sendSteer = (): void => {
    const text = steerText.trim();
    if (text === "" || steer.isPending) return;
    void steer.mutateAsync(text).then((result) => {
      if (result.ok) setSteerText("");
      refreshPeek();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendSteer();
    }
  };

  const handleInterruptClick = (): void => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    void interrupt.mutateAsync().then(refreshPeek);
  };

  const lastError = steer.data?.ok === false ? (steer.data.error ?? steer.data.stderr) : undefined;

  return (
    <div className="flex flex-col gap-2 border border-factory-border bg-factory-panel p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wide text-factory-dim">Unstick ladder</span>
        <button
          type="button"
          onClick={refreshPeek}
          className="font-mono text-[11px] text-factory-dim hover:text-factory-accent"
        >
          peek now
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={steerText}
          onChange={(event) => setSteerText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Steer this crew (fm-send)…"
          className="flex-1 border border-factory-border bg-factory-bg p-1.5 font-mono text-xs text-factory-text placeholder:text-factory-dim"
        />
        <button
          type="button"
          onClick={sendSteer}
          disabled={steer.isPending || steerText.trim() === ""}
          className="border border-factory-accent px-2 py-1 font-mono text-xs text-factory-accent disabled:opacity-40"
        >
          Steer
        </button>
        <button
          type="button"
          onClick={handleInterruptClick}
          disabled={interrupt.isPending}
          className={`border px-2 py-1 font-mono text-xs disabled:opacity-40 ${
            armed
              ? "border-red-700 text-red-400"
              : "border-factory-border text-factory-dim hover:border-red-700 hover:text-red-400"
          }`}
        >
          {armed ? "Confirm interrupt?" : "Interrupt"}
        </button>
      </div>
      {lastError !== undefined && <p className="font-mono text-[11px] text-red-400">{lastError}</p>}
    </div>
  );
}
