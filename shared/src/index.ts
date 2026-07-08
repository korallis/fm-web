// Wire types shared between the FM Deck server and client.
// Kept dependency-free so both workspaces can import it directly.

export type TaskKind = "ship" | "scout" | "secondmate";

/** `state/<id>.meta` — key=value pairs. Unknown keys pass through in `extra`. */
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

/** `data/projects.md` — one project registry line. */
export interface ProjectEntry {
  name: string;
  mode: string;
  yolo: boolean;
  description: string;
  added: string;
}

/** `data/secondmates.md` — one secondmate registry line. */
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

export interface FleetTask {
  id: string;
  meta: CrewMeta;
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

export interface FleetSnapshot {
  generatedAtMs: number;
  fmHome: string;
  tasks: FleetTask[];
  backlog: Backlog;
  projects: ProjectEntry[];
  secondmates: SecondmateEntry[];
  supervision: SupervisionHealth;
}
