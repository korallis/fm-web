import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { AuditLogEntry, GuardedActionRequest, GuardedActionResult } from "@fm-web/shared";
import { readGuardedActionResponse } from "./guardedActionResult";

const AUDIT_QUERY_KEY = ["advanced-audit"] as const;

async function runAdvancedAction(request: GuardedActionRequest): Promise<GuardedActionResult> {
  const res = await fetch("/api/advanced/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  return readGuardedActionResponse(res, "POST /api/advanced/run");
}

/** The advanced drawer's one execution path - direct mutating-script execution, explicitly not
 * routed through the composer's verified-submit channel (that channel only reaches the app-owned
 * session, not arbitrary firstmate scripts). */
export function useAdvancedRun(): UseMutationResult<GuardedActionResult, Error, GuardedActionRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runAdvancedAction,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: AUDIT_QUERY_KEY }),
  });
}

async function fetchAudit(): Promise<AuditLogEntry[]> {
  const res = await fetch("/api/advanced/audit");
  if (!res.ok) throw new Error(`GET /api/advanced/audit failed: ${res.status}`);
  const body = (await res.json()) as { entries: AuditLogEntry[] };
  return body.entries;
}

export function useAdvancedAudit(): UseQueryResult<AuditLogEntry[], Error> {
  return useQuery({ queryKey: AUDIT_QUERY_KEY, queryFn: fetchAudit });
}
