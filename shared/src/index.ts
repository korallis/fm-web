// Wire types shared between the FM Deck server and client.
// Kept dependency-free so both workspaces can import it directly.

export type TaskKind = "ship" | "scout" | "secondmate";

/** `state/<id>.meta` - key=value pairs. Unknown keys pass through in `extra`. */
export interface CrewMeta {
  window?: string;
  worktree?: string;
  project?: string;
  harness?: string;
  kind: TaskKind;
  mode?: string;
  yolo?: string;
  tasktmp?: string;
  model?: string;
  effort?: string;
  backend?: string;
  terminal?: string;
  orca_worktree_id?: string;
  pr?: string;
  pr_head?: string;
  x_request?: string;
  x_request_ts?: string;
  x_followups?: string;
  /** Any key not modeled above (herdr_*, future fields, etc). */
  extra: Record<string, string>;
}

export type StatusVerb = "working" | "needs-decision" | "blocked" | "done" | "failed" | "unknown";

/** One append-only line from `state/<id>.status`. */
export interface StatusEntry {
  verb: StatusVerb;
  rawVerb: string;
  note: string;
  raw: string;
}

export type WakeKind = "signal" | "stale" | "check" | "heartbeat";

/** One record from `state/.wake-queue` (tab-separated). */
export interface WakeEntry {
  epoch: number;
  seq: number;
  kind: WakeKind;
  key: string;
  payload: string;
}

export interface LockInfo {
  /** null when `state/.lock` does not exist (free). */
  pid: number | null;
  /** true when the PID is a live holder, or when an unreadable/malformed lock fails closed. */
  alive: boolean | null;
}

export interface BlockedBy {
  id: string;
  reason: string;
}

export interface BacklogTask {
  id: string;
  description: string;
  repo?: string;
  kindTag?: string;
  since?: string;
  blockedBy?: BlockedBy;
}

export interface BacklogDoneTask {
  id: string;
  description: string;
  /** PR URL or "local main" or a report.md path. */
  mergeTarget?: string;
  repo?: string;
  kindTag?: string;
  dateLabel?: string;
  date?: string;
}

export interface Backlog {
  inFlight: BacklogTask[];
  queued: BacklogTask[];
  done: BacklogDoneTask[];
}

/** `data/projects.md` - one project registry line. */
export interface ProjectEntry {
  name: string;
  mode: string;
  yolo: boolean;
  description: string;
  added: string;
}

/** A discoverable firstmate home: the booted primary, or a registered secondmate's resolved home. */
export interface HomeEntry {
  /** Stable id for `?home=` routing; `"primary"` means the booted `FM_HOME`. */
  id: string;
  /** Resolved filesystem path returned for display/debugging, not arbitrary client input. */
  path: string;
  label: string;
}

/** `data/secondmates.md` - one secondmate registry line. */
export interface SecondmateEntry {
  id: string;
  summary: string;
  home: string;
  scope: string;
  projects: string[];
  added: string;
}

export type CrewState = "working" | "parked" | "done" | "blocked" | "failed" | "unknown";

export type CrewStateSource = "run-step" | "pane" | "status-log" | "none";

/** Parsed stdout of `bin/fm-crew-state.sh <id>`. */
export interface CrewStateOutput {
  state: CrewState;
  source: CrewStateSource;
  detail: string;
}

export const DEFAULT_SERVER_PORT = 4870;

export function parsePortValue(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const port = Number(trimmed);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

export function loadPortFromEnv(env: Record<string, string | undefined>): number {
  return parsePortValue(env["PORT"]) ?? DEFAULT_SERVER_PORT;
}

export interface FleetTask {
  id: string;
  meta: CrewMeta;
  crewState: CrewStateOutput;
  latestStatus: StatusEntry | null;
  captainRelevant: boolean;
  backlogRef: BacklogTask | null;
  /** Read-only liveness proxy: does `meta.worktree` still exist on disk (mirrors fm-crew-state.sh's own first check). */
  worktreePresent: boolean;
}

export interface SupervisionHealth {
  lock: LockInfo;
  /** ms since epoch of `state/.last-watcher-beat` mtime, null if the file is absent. */
  beaconLastBeatMs: number | null;
  beaconAgeSeconds: number | null;
  beaconFresh: boolean;
  afk: boolean;
  timing: TimingConstants;
}

export interface TimingConstants {
  pollSeconds: number;
  guardGraceSeconds: number;
  heartbeatBaseSeconds: number;
  heartbeatMaxSeconds: number;
  staleEscalateSeconds: number;
  checkIntervalSeconds: number;
}

/** One line from `state/.watch-triage.log` - `[ISO8601±TZ] <message>`, the watcher's absorbed-wake debug trail. */
export interface WatchTriageEntry {
  /** null when the leading `[...]` timestamp is missing or unparseable. */
  timestampMs: number | null;
  message: string;
  raw: string;
}

/**
 * The decisions inbox surfaces the subset of {@link CrewState} values that need a captain's eyes,
 * derived from each task's already-parsed crew state - see `adapter/decisions.ts`.
 * - `needs-decision`: a manual `needs-decision:` status append (crew-state source `status-log`).
 * - `parked-gate`: a no-mistakes gate awaiting approval (crew-state source `run-step`).
 * - `done` / `blocked` / `failed`: the matching current crew state.
 */
export type DecisionCategory = "needs-decision" | "parked-gate" | "done" | "blocked" | "failed";

export interface DecisionItem {
  taskId: string;
  category: DecisionCategory;
  /** Verbatim detail text - the raw status line when available, else the crew-state detail. */
  detail: string;
  source: CrewStateSource;
}

export interface FleetSnapshot {
  generatedAtMs: number;
  fmHome: string;
  tasks: FleetTask[];
  backlog: Backlog;
  projects: ProjectEntry[];
  secondmates: SecondmateEntry[];
  supervision: SupervisionHealth;
  decisions: DecisionItem[];
  /** Read-only tail of `state/.wake-queue`, surfaced wakes that escalated to firstmate. */
  wakeQueue: WakeEntry[];
  /** Read-only tail of `state/.watch-triage.log`, absorbed wakes classified away by the watcher. */
  watchTriage: WatchTriageEntry[];
}

/** `state/<id>.meta`'s `pr=`/`pr_head=` plus whether `fm-pr-check.sh` armed the merge poll. */
export interface PrStatus {
  url: string | null;
  headSha: string | null;
  /** `state/<id>.check.sh` exists — the watcher polls it for a merge/close signal. */
  pollArmed: boolean;
  /** PR URL parsed out of `check.sh`'s `gh pr view <url>` call, when armed. */
  pollTargetUrl: string | null;
}

/**
 * Full read-only detail for one task's detail page. `statusHistory` is the COMPLETE append-only
 * `.status` log for display as history/wake-events only — `crewState` (from `fm-crew-state.sh`,
 * never the raw log) remains the sole source of current-state truth; see the adapter's doc comment.
 */
export interface TaskDetail {
  id: string;
  meta: CrewMeta;
  crewState: CrewStateOutput;
  statusHistory: StatusEntry[];
  brief: string | null;
  report: string | null;
  pr: PrStatus;
  /**
   * Raw TOON stdout of `no-mistakes axi status` in the task's worktree — the same non-mutating
   * query `fm-crew-state.sh` already runs internally for every fleet task on every poll. Decode
   * with `@toon-format/toon` client-side; null when there's no run, no worktree, or the call
   * failed/timed out.
   */
  gateStatusRaw: string | null;
}

// ---- Phase 2: command deck (app-owned first-mate session) ----

/** A runtime-discovered skill (`.claude/skills/<id>/SKILL.md` or `.agents/skills/<id>/SKILL.md`). */
export interface SkillEntry {
  id: string;
  name: string;
  description: string;
  /** Only skills with `user-invocable: true` in frontmatter are surfaced as quick actions. */
  userInvocable: boolean;
  source: ".claude" | ".agents";
}

export type ComposerQueueStatus = "queued" | "sending" | "sent" | "failed";

export interface ComposerQueueEntry {
  id: string;
  text: string;
  enqueuedAtMs: number;
  status: ComposerQueueStatus;
  /** Set once resolved: the verified-submit verdict, or an error message. */
  detail?: string;
}

export interface ComposerState {
  /** True when the app-owned session's pane shows a busy footer (mid-turn). */
  busy: boolean;
  /** True when a live firstmate session other than our own owned one holds `state/.lock`. */
  readOnly: boolean;
  skillInvocationPrefix: "/" | "$";
  lock: LockInfo;
  queue: ComposerQueueEntry[];
  sessionReady: boolean;
}

export interface ComposerSendResult {
  accepted: boolean;
  entryId?: string;
  error?: string;
}

/** Messages pushed over `/ws/session` for the response terminal + composer state. */
export type SessionWsMessage =
  | { type: "snapshot"; text: string }
  | { type: "chunk"; text: string }
  | { type: "composerState"; state: ComposerState };
