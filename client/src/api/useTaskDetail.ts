import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TaskDetail } from "@fm-web/shared";

export function taskDetailQueryKey(homeId: string, id: string): readonly ["task", string, string] {
  return ["task", homeId, id] as const;
}

async function fetchTaskDetail(homeId: string, id: string): Promise<TaskDetail> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}?home=${encodeURIComponent(homeId)}`);
  if (!res.ok) throw new Error(`GET /api/tasks/${id} failed: ${res.status}`);
  return (await res.json()) as TaskDetail;
}

export function useTaskDetail(homeId: string, id: string): UseQueryResult<TaskDetail, Error> {
  return useQuery({
    queryKey: taskDetailQueryKey(homeId, id),
    queryFn: () => fetchTaskDetail(homeId, id),
  });
}
