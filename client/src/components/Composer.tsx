import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ComposerState, SkillEntry } from "@fm-web/shared";
import { StateChip, type ChipTone } from "./StateChip";
import { SkillQuickActions } from "./SkillQuickActions";
import { useComposerLocalState } from "../composer/useComposerLocalState";
import { useComposerSend, interruptSession } from "../api/useComposerSend";
import { useSkills } from "../api/useSkills";

const QUEUE_STATUS_TONE: Record<string, ChipTone> = {
  queued: "neutral",
  sending: "accent",
  sent: "done",
  failed: "danger",
};

export interface ComposerProps {
  fmHome: string | undefined;
  composerState: ComposerState | undefined;
}

/** The one busy-aware, verified-submit channel every instruction path converges on. */
export function Composer({ fmHome, composerState }: ComposerProps) {
  const { draft, setDraft, history, pushHistory } = useComposerLocalState(fmHome);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const send = useComposerSend();
  const { data: skills } = useSkills();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sessionReady = composerState?.sessionReady ?? false;
  const readOnly = composerState?.readOnly ?? false;
  const busy = composerState?.busy ?? false;
  const skillInvocationPrefix = composerState?.skillInvocationPrefix ?? "/";
  const disabled = !sessionReady || readOnly;

  const submit = (text: string): void => {
    const trimmed = text.trim();
    if (trimmed === "" || disabled) return;
    void send
      .mutateAsync(trimmed)
      .then((result) => {
        if (!result.accepted) return;
        pushHistory(trimmed);
        setHistoryIndex(null);
      })
      .catch(() => undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(draft);
      return;
    }
    if (event.key === "ArrowUp" && draft.trim() === "" && history.length > 0) {
      event.preventDefault();
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setDraft(history[nextIndex] ?? "");
    }
  };

  const selectSkill = (skill: SkillEntry): void => {
    setDraft(`${skillInvocationPrefix}${skill.id}`);
    textareaRef.current?.focus();
  };

  const recentQueue = composerState?.queue.slice(-5) ?? [];

  return (
    <div className="flex flex-col gap-3 border border-factory-border bg-factory-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        {fmHome !== undefined && <StateChip label={fmHome} tone="neutral" />}
        {!sessionReady && <StateChip label="session unavailable" tone="danger" />}
        {sessionReady && readOnly && (
          <StateChip label="read-only — another session holds the lock" tone="warn" />
        )}
        {sessionReady && !readOnly && (
          <StateChip label={busy ? "busy" : "idle"} tone={busy ? "accent" : "done"} />
        )}
        {busy && !readOnly && sessionReady && (
          <button
            type="button"
            onClick={() => void interruptSession()}
            className="border border-factory-border px-2 py-0.5 font-mono text-[11px] text-factory-dim hover:border-red-700 hover:text-red-400"
          >
            Ctrl+C
          </button>
        )}
      </div>

      {skills !== undefined && (
        <SkillQuickActions
          skills={skills}
          skillInvocationPrefix={skillInvocationPrefix}
          onSelect={selectSkill}
        />
      )}

      <textarea
        ref={textareaRef}
        name="composer-prompt"
        aria-label="Message the first mate"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={
          readOnly
            ? "read-only — another live firstmate session holds the lock"
            : "Message the first mate… (Enter to send, Shift+Enter for a newline)"
        }
        rows={3}
        className="w-full resize-none border border-factory-border bg-factory-bg p-2 font-mono text-sm text-factory-text placeholder:text-factory-dim disabled:opacity-50"
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => submit(draft)}
          disabled={disabled || draft.trim() === ""}
          className="border border-factory-accent px-3 py-1 font-mono text-xs text-factory-accent disabled:opacity-40"
        >
          Send
        </button>
        <div className="flex flex-wrap justify-end gap-1">
          {recentQueue.map((entry) => (
            <StateChip
              key={entry.id}
              label={`${entry.status}: ${entry.text.slice(0, 24)}`}
              tone={QUEUE_STATUS_TONE[entry.status] ?? "neutral"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
