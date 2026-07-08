import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TaskDetail } from "@fm-web/shared";

async function fetchTaskDetail(id: string): Promise<TaskDetail> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GET /api/tasks/${id} failed: ${res.status}`);
  return (await res.json()) as TaskDetail;
}

export function useTaskDetail(id: string): UseQueryResult<TaskDetail, Error> {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchTaskDetail(id),
  });
}
