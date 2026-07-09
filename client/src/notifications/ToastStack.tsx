import { useEffect, useRef } from "react";
import type { Toast } from "./useCaptainNotifications";

const TOAST_TTL_MS = 8000;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Schedules once per mounted toast - reading onDismiss through a ref so a parent re-render
  // (a new toast arriving) never resets an already-ticking dismiss timer.
  useEffect(() => {
    const timer = window.setTimeout(() => onDismissRef.current(), TOAST_TTL_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="w-72 border border-factory-accent bg-factory-panel p-2 text-left font-mono text-xs"
    >
      <p className="text-factory-accent">{toast.title}</p>
      <p className="mt-1 truncate text-factory-dim">{toast.body}</p>
    </button>
  );
}

/** Fixed top-right stack for newly-appeared captain-relevant decisions - see useCaptainNotifications. */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: readonly Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}
