import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import type { GuardedActionResult } from "@fm-web/shared";

async function postJson(url: string, body?: unknown): Promise<GuardedActionResult> {
  const init: RequestInit = { method: "POST" };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  return (await res.json()) as GuardedActionResult;
}

/** The "steer" rung of the unstick ladder: `fm-send.sh <target> <text>` - a guarded action, not
 * the app-owned composer queue, since the target is a crew's OWN session. */
export function useTaskSteer(
  homeId: string,
  taskId: string,
): UseMutationResult<GuardedActionResult, Error, string> {
  return useMutation({
    mutationFn: (text: string) =>
      postJson(`/api/tasks/${encodeURIComponent(taskId)}/send?home=${encodeURIComponent(homeId)}`, { text }),
  });
}

/** The "interrupt" rung: `fm-send.sh <target> --key C-c`. */
export function useTaskInterrupt(
  homeId: string,
  taskId: string,
): UseMutationResult<GuardedActionResult, Error, void> {
  return useMutation({
    mutationFn: () =>
      postJson(`/api/tasks/${encodeURIComponent(taskId)}/interrupt?home=${encodeURIComponent(homeId)}`),
  });
}
