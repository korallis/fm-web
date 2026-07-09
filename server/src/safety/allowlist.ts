/**
 * The guarded script runner's allowlists. This is the one place that decides what firstmate
 * scripts this app may ever invoke - see the plan's Safety contract for the full rationale.
 */

/** Read-only anytime, per the safety contract. `fm-lock.sh` is restricted to the `status` arg below. */
export const READ_ONLY_SCRIPTS = [
  "fm-peek.sh",
  "fm-crew-state.sh",
  "fm-project-mode.sh",
  "fm-review-diff.sh",
  "fm-lock.sh",
] as const;

/** Future mutating surfaces only, and NOT wired to any caller today - always refused here. */
export const MUTATING_SCRIPTS = [
  "fm-brief.sh",
  "fm-spawn.sh",
  "fm-send.sh",
  "fm-teardown.sh",
  "fm-pr-check.sh",
  "fm-pr-merge.sh",
  "fm-merge-local.sh",
  "fm-promote.sh",
  "fm-watch-arm.sh",
] as const;

/**
 * Never run from the app under any flag, allowlist or not - they destructively drain the
 * wake queue or take the harness lock out from under a live session.
 */
export const NEVER_RUN_SCRIPTS = ["fm-session-start.sh", "fm-wake-drain.sh"] as const;

export type ReadOnlyScript = (typeof READ_ONLY_SCRIPTS)[number];
export type MutatingScript = (typeof MUTATING_SCRIPTS)[number];
