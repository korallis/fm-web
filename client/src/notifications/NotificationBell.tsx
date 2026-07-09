import { StateChip } from "../components/StateChip";

export function NotificationBell({
  permission,
  onRequest,
}: {
  permission: NotificationPermission | "unsupported";
  onRequest: () => void;
}) {
  if (permission === "unsupported") return null;
  if (permission === "granted") return <StateChip label="notify: on" tone="done" />;
  if (permission === "denied") return <StateChip label="notify: blocked" tone="warn" />;

  return (
    <button
      type="button"
      onClick={onRequest}
      className="border border-factory-border px-2 py-0.5 font-mono text-[11px] text-factory-dim hover:border-factory-accent hover:text-factory-accent"
    >
      Enable notifications
    </button>
  );
}
