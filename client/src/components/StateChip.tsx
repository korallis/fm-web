export type ChipTone = "accent" | "done" | "warn" | "danger" | "neutral";

const TONE_CLASSES: Record<ChipTone, string> = {
  accent: "border-factory-accent text-factory-accent",
  done: "border-emerald-600 text-emerald-400",
  warn: "border-amber-600 text-amber-400",
  danger: "border-red-700 text-red-400",
  neutral: "border-factory-border text-factory-dim",
};

export function StateChip({ label, tone = "neutral" }: { label: string; tone?: ChipTone }) {
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
