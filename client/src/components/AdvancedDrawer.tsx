import { useState } from "react";
import type { GuardedActionResult } from "@fm-web/shared";
import { useAdvancedAudit, useAdvancedRun } from "../api/useAdvancedActions";
import { useComposerSend } from "../api/useComposerSend";
import { StateChip } from "./StateChip";

interface DrawerField {
  key: string;
  label: string;
  kind: "text" | "checkbox";
  required?: boolean;
  placeholder?: string;
}

type FieldValues = Record<string, string | boolean>;

interface LastRun {
  commandLine: string;
  result: GuardedActionResult;
}

interface DrawerScriptSpec {
  script: string;
  label: string;
  readOnly?: boolean;
  fields: DrawerField[];
  buildArgs: (values: FieldValues) => string[];
  /** Field key holding the task id the confirm box must re-type; undefined for global scripts,
   * which instead require typing the script name. */
  confirmKey?: string;
}

function textOf(values: FieldValues, key: string): string {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

function flagIf(values: FieldValues, key: string, flag: string): string[] {
  return values[key] === true ? [flag] : [];
}

/**
 * One entry per script on `MUTATING_SCRIPTS` plus the read-only `fm-review-diff.sh` - see
 * `server/src/safety/allowlist.ts`. `fm-brief.sh` is deliberately not surfaced here: authoring a
 * brief needs real content, not just flags, and isn't named in the integration task's scope.
 */
const DRAWER_SCRIPTS: readonly DrawerScriptSpec[] = [
  {
    script: "fm-spawn.sh",
    label: "Spawn",
    confirmKey: "taskId",
    fields: [
      { key: "taskId", label: "Task id", kind: "text", required: true, placeholder: "task-a1" },
      {
        key: "projectDir",
        label: "Project dir",
        kind: "text",
        required: true,
        placeholder: "/path/to/project",
      },
      { key: "harness", label: "Harness (required)", kind: "text", required: true, placeholder: "claude" },
      { key: "model", label: "Model (optional)", kind: "text", placeholder: "e.g. sonnet-5" },
      { key: "effort", label: "Effort (optional)", kind: "text", placeholder: "low|medium|high|xhigh|max" },
      { key: "scout", label: "Scout (report only, no branch/PR)", kind: "checkbox" },
    ],
    buildArgs: (v) => {
      const args = [textOf(v, "taskId"), textOf(v, "projectDir"), "--harness", textOf(v, "harness")];
      const model = textOf(v, "model");
      if (model !== "") args.push("--model", model);
      const effort = textOf(v, "effort");
      if (effort !== "") args.push("--effort", effort);
      return [...args, ...flagIf(v, "scout", "--scout")];
    },
  },
  {
    script: "fm-teardown.sh",
    label: "Teardown",
    confirmKey: "taskId",
    fields: [
      { key: "taskId", label: "Task id", kind: "text", required: true, placeholder: "task-a1" },
      { key: "force", label: "--force (skip landed-work checks)", kind: "checkbox" },
    ],
    buildArgs: (v) => [textOf(v, "taskId"), ...flagIf(v, "force", "--force")],
  },
  {
    script: "fm-merge-local.sh",
    label: "Merge (local)",
    confirmKey: "taskId",
    fields: [{ key: "taskId", label: "Task id", kind: "text", required: true, placeholder: "task-a1" }],
    buildArgs: (v) => [textOf(v, "taskId")],
  },
  {
    script: "fm-pr-merge.sh",
    label: "Merge (PR)",
    confirmKey: "taskId",
    fields: [
      { key: "taskId", label: "Task id", kind: "text", required: true, placeholder: "task-a1" },
      {
        key: "prUrl",
        label: "PR URL",
        kind: "text",
        required: true,
        placeholder: "https://github.com/…/pull/123",
      },
    ],
    buildArgs: (v) => [textOf(v, "taskId"), textOf(v, "prUrl")],
  },
  {
    script: "fm-pr-check.sh",
    label: "Arm merge-poll",
    confirmKey: "taskId",
    fields: [
      { key: "taskId", label: "Task id", kind: "text", required: true, placeholder: "task-a1" },
      {
        key: "prUrl",
        label: "PR URL",
        kind: "text",
        required: true,
        placeholder: "https://github.com/…/pull/123",
      },
    ],
    buildArgs: (v) => [textOf(v, "taskId"), textOf(v, "prUrl")],
  },
  {
    script: "fm-promote.sh",
    label: "Promote",
    confirmKey: "taskId",
    fields: [{ key: "taskId", label: "Task id", kind: "text", required: true, placeholder: "task-a1" }],
    buildArgs: (v) => [textOf(v, "taskId")],
  },
  {
    script: "fm-watch-arm.sh",
    label: "Arm watcher",
    fields: [{ key: "restart", label: "--restart (force-restart the watcher)", kind: "checkbox" }],
    buildArgs: (v) => flagIf(v, "restart", "--restart"),
  },
  {
    script: "fm-review-diff.sh",
    label: "Review diff",
    readOnly: true,
    confirmKey: "taskId",
    fields: [
      { key: "taskId", label: "Task id", kind: "text", required: true, placeholder: "task-a1" },
      { key: "stat", label: "--stat (summary only)", kind: "checkbox" },
    ],
    buildArgs: (v) => [textOf(v, "taskId"), ...flagIf(v, "stat", "--stat")],
  },
];

function ScriptForm({
  spec,
  values,
  onChange,
}: {
  spec: DrawerScriptSpec;
  values: FieldValues;
  onChange: (key: string, value: string | boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {spec.fields.map((field) => (
        <label key={field.key} className="flex flex-col gap-1 font-mono text-xs text-factory-dim">
          {field.kind === "checkbox" ? (
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values[field.key] === true}
                onChange={(event) => onChange(field.key, event.target.checked)}
              />
              {field.label}
            </span>
          ) : (
            <>
              <span>
                {field.label}
                {field.required === true ? " *" : ""}
              </span>
              <input
                type="text"
                value={typeof values[field.key] === "string" ? (values[field.key] as string) : ""}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className="border border-factory-border bg-factory-bg p-1.5 font-mono text-xs text-factory-text placeholder:text-factory-dim"
              />
            </>
          )}
        </label>
      ))}
    </div>
  );
}

/**
 * The explicitly-marked advanced drawer: the only place this app runs a mutating firstmate script
 * directly, rather than through the composer's verified-submit channel. Every run requires a
 * command preview and a typed confirm, is recorded to the audit log, and can FYI the first mate
 * afterward - through the ordinary composer send, same as everywhere else.
 */
export function AdvancedDrawer() {
  const [open, setOpen] = useState(false);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [values, setValues] = useState<FieldValues>({});
  const [confirmText, setConfirmText] = useState("");
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const run = useAdvancedRun();
  const { data: audit } = useAdvancedAudit();
  const composerSend = useComposerSend();

  const spec = DRAWER_SCRIPTS[scriptIndex];
  if (spec === undefined) return null;

  const selectScript = (index: number): void => {
    setScriptIndex(index);
    setValues({});
    setConfirmText("");
    setLastRun(null);
    run.reset();
  };

  const setField = (key: string, value: string | boolean): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const args = spec.buildArgs(values);
  const commandLine = [spec.script, ...args].join(" ");
  const missingRequired = spec.fields.some(
    (field) => field.required === true && textOf(values, field.key) === "",
  );
  const requiredConfirmValue = spec.confirmKey !== undefined ? textOf(values, spec.confirmKey) : spec.script;
  const confirmSatisfied = confirmText.trim() !== "" && confirmText.trim() === requiredConfirmValue;
  const canRun = !missingRequired && confirmSatisfied && !run.isPending;

  const runNow = (): void => {
    if (!canRun) return;
    const request = { script: spec.script, args: [...args] };
    const executedCommandLine = [request.script, ...request.args].join(" ");
    setLastRun(null);
    void run.mutateAsync(request).then((result) => setLastRun({ commandLine: executedCommandLine, result }));
  };

  const sendFyi = (): void => {
    if (lastRun === null) return;
    const text = `FYI: ran \`${lastRun.commandLine}\` via the advanced drawer - ${
      lastRun.result.ok ? "ok" : "failed"
    }.`;
    void composerSend.mutateAsync(text);
  };

  return (
    <div className="flex flex-col gap-3 border border-amber-700/60 bg-factory-panel p-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between font-mono text-xs uppercase tracking-wide text-amber-400"
      >
        <span>Advanced drawer - direct script execution</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {DRAWER_SCRIPTS.map((option, index) => (
              <button
                key={option.script}
                type="button"
                onClick={() => selectScript(index)}
                className={`border px-2 py-1 font-mono text-[11px] uppercase tracking-wide ${
                  index === scriptIndex
                    ? "border-factory-accent text-factory-accent"
                    : "border-factory-border text-factory-dim hover:text-factory-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <StateChip label={spec.script} tone="neutral" />
            {spec.readOnly === true && <StateChip label="read-only" tone="done" />}
          </div>

          <ScriptForm spec={spec} values={values} onChange={setField} />

          <div className="flex flex-col gap-1 border border-factory-border bg-factory-bg p-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-factory-dim">
              Command preview
            </span>
            <code className="whitespace-pre-wrap break-all font-mono text-xs text-factory-text">
              {commandLine}
            </code>
          </div>

          <label className="flex flex-col gap-1 font-mono text-xs text-factory-dim">
            <span>
              Type <strong className="text-factory-text">{requiredConfirmValue || "…"}</strong> to confirm
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="border border-factory-border bg-factory-bg p-1.5 font-mono text-xs text-factory-text"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runNow}
              disabled={!canRun}
              className="border border-red-700 px-3 py-1 font-mono text-xs text-red-400 disabled:opacity-40"
            >
              Run
            </button>
            {lastRun !== null && (
              <button
                type="button"
                onClick={sendFyi}
                disabled={composerSend.isPending}
                className="border border-factory-border px-2 py-1 font-mono text-[11px] text-factory-dim hover:border-factory-accent hover:text-factory-accent disabled:opacity-40"
              >
                FYI the first mate
              </button>
            )}
          </div>

          {lastRun !== null && (
            <div className="flex flex-col gap-1 border border-factory-border bg-factory-bg p-2">
              <StateChip
                label={lastRun.result.ok ? "ok" : "failed"}
                tone={lastRun.result.ok ? "done" : "danger"}
              />
              {lastRun.result.error !== undefined && (
                <p className="font-mono text-xs text-red-400">{lastRun.result.error}</p>
              )}
              {lastRun.result.stdout !== "" && (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-factory-text">
                  {lastRun.result.stdout}
                </pre>
              )}
              {lastRun.result.stderr !== "" && (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-red-400">
                  {lastRun.result.stderr}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wide text-factory-dim">
              Audit log (this session)
            </span>
            {audit === undefined || audit.length === 0 ? (
              <p className="font-mono text-[11px] text-factory-dim">No actions run yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {audit.slice(0, 20).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 font-mono text-[11px] text-factory-dim"
                  >
                    <StateChip label={entry.ok ? "ok" : "failed"} tone={entry.ok ? "done" : "danger"} />
                    <span>{new Date(entry.atMs).toLocaleTimeString()}</span>
                    <span className="truncate text-factory-text">
                      {[entry.script, ...entry.args].join(" ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
