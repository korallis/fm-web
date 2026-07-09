import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { PeekResult } from "@fm-web/shared";

const PEEK_POLL_MS = 4000;
const PEEK_LINES = 400;

export function taskPeekQueryKey(homeId: string, id: string): readonly ["task-peek", string, string] {
  return ["task-peek", homeId, id] as const;
}

async function fetchTaskPeek(homeId: string, id: string): Promise<PeekResult> {
  const res = await fetch(
    `/api/tasks/${encodeURIComponent(id)}/peek?home=${encodeURIComponent(homeId)}&lines=${PEEK_LINES}`,
  );
  if (!res.ok) throw new Error(`GET /api/tasks/${id}/peek failed: ${res.status}`);
  return (await res.json()) as PeekResult;
}

/** Polls `fm-peek.sh` for a live (if coarse) view of a crew's own session - there's no per-task
 * chunk stream, so this is a periodic full-snapshot poll, not a websocket. */
export function useTaskPeek(homeId: string, id: string): UseQueryResult<PeekResult, Error> {
  return useQuery({
    queryKey: taskPeekQueryKey(homeId, id),
    queryFn: () => fetchTaskPeek(homeId, id),
    refetchInterval: PEEK_POLL_MS,
  });
}
