import { useEffect, useRef, useState } from "react";
import type { DecisionCategory, DecisionItem } from "@fm-web/shared";

export interface Toast {
  id: string;
  title: string;
  body: string;
}

const CATEGORY_LABEL: Record<DecisionCategory, string> = {
  "needs-decision": "Needs decision",
  "parked-gate": "Parked gate",
  done: "PR-ready",
  blocked: "Blocked",
  failed: "Failed",
};

function decisionKey(item: DecisionItem): string {
  return `${item.taskId}:${item.category}`;
}

export interface CaptainNotifications {
  toasts: Toast[];
  dismissToast: (id: string) => void;
  permission: NotificationPermission | "unsupported";
  requestPermission: () => void;
}

/**
 * Diffs each fresh `decisions` list against the previously seen one and raises a toast (plus a
 * browser Notification when permission is granted, so a backgrounded tab still pages the captain)
 * for every newly-appeared item. The first snapshot after mount is a baseline, never notified -
 * otherwise every decision already pending at app load would fire at once. `homeId` re-baselines
 * the same way on every switch, so navigating into a different (already-decision-laden) home
 * doesn't read as a burst of brand-new decisions.
 */
export function useCaptainNotifications(
  homeId: string,
  decisions: readonly DecisionItem[] | undefined,
): CaptainNotifications {
  const seenRef = useRef<Set<string> | null>(null);
  const seenHomeIdRef = useRef(homeId);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  useEffect(() => {
    if (decisions === undefined) return;
    const currentKeys = new Set(decisions.map(decisionKey));

    const homeChanged = seenHomeIdRef.current !== homeId;
    seenHomeIdRef.current = homeId;

    const seen = seenRef.current;
    if (seen === null || homeChanged) {
      seenRef.current = currentKeys;
      return;
    }
    seenRef.current = currentKeys;

    const fresh = decisions.filter((item) => !seen.has(decisionKey(item)));
    if (fresh.length === 0) return;

    setToasts((prev) => [
      ...prev,
      ...fresh.map((item) => ({
        id: `${decisionKey(item)}-${Math.random().toString(36).slice(2)}`,
        title: `${CATEGORY_LABEL[item.category]}: ${item.taskId}`,
        body: item.detail,
      })),
    ]);

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      for (const item of fresh) {
        new Notification(`${CATEGORY_LABEL[item.category]}: ${item.taskId}`, { body: item.detail });
      }
    }
  }, [decisions, homeId]);

  const dismissToast = (id: string): void => setToasts((prev) => prev.filter((toast) => toast.id !== id));

  const requestPermission = (): void => {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then(setPermission);
  };

  return { toasts, dismissToast, permission, requestPermission };
}
