import { useCallback, useEffect, useState } from "react";

function readTaskIdFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get("task");
}

export interface TaskRoute {
  taskId: string | null;
  openTask(id: string): void;
  closeTask(): void;
}

/** Query-string-based nav (`?task=<id>`) — no router dependency for one optional detail view. */
export function useTaskRoute(): TaskRoute {
  const [taskId, setTaskId] = useState<string | null>(() => readTaskIdFromLocation());

  useEffect(() => {
    const onPopState = (): void => setTaskId(readTaskIdFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openTask = useCallback((id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("task", id);
    window.history.pushState({}, "", url);
    setTaskId(id);
  }, []);

  const closeTask = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("task");
    window.history.pushState({}, "", url);
    setTaskId(null);
  }, []);

  return { taskId, openTask, closeTask };
}
