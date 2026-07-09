# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## Layout

Bun workspaces: `shared/` (wire types, no runtime deps), `server/` (Bun + Hono, strict TS), `client/` (Vite + React 19 + Tailwind 4). Full architecture and phase plan: `/Users/leebarry/fm/firstmate/data/fm-web-plan.md` (captain-owned, outside this repo).

## Build/test

`bun install`, `bun run typecheck` / `lint` / `format` / `test` / `build` at the repo root fan out to all three workspaces. `bun` is not on PATH by default in some shells here - use `$HOME/.bun/bin/bun` or `export PATH="$HOME/.bun/bin:$PATH"` first.

## FM adapter + safety module

`server/src/adapter/*` parses the Phase 1 firstmate formats (meta/status/wake-queue/lock/beacon/.afk/backlog/projects/secondmates/crew-state grammar, plus Phase 4's watch-triage log) read-only; `taskDetail.ts` (Phase 3) composes those plus brief/report file reads and PR/merge-poll status (`state/<id>.check.sh`) into one task-detail snapshot, served at `GET /api/tasks/:id?home=<id>`. `server/src/safety/{allowlist,scriptRunner}.ts` is the one guarded-execution gate - read the safety contract in the plan above before touching either. It also exports `readNoMistakesGateStatus`, a bounded, read-only call to `no-mistakes axi status` in a crew's worktree (the same non-mutating query `fm-crew-state.sh` already shells out to for every fleet task) - deliberately separate from the `bin/fm-*.sh` allowlist since `no-mistakes` is a different tool, not a firstmate script; its raw TOON output is decoded client-side with `@toon-format/toon` (`client/src/lib/decodeGateStatus.ts`) for the task-detail gate-findings panel. Tests run against the sanitized fixture home at `server/test/fixtures/fm-home/` - NEVER point tests or dev at a live firstmate home.

`fm-crew-state.sh`'s `parked` state is ambiguous on its own: `source: run-step` means a no-mistakes gate is awaiting approval, while any other source means the log fallback mapped a manual `needs-decision:` status append to `parked` for display (see the reference script's `map_log_state()`). `server/src/adapter/decisions.ts` splits on `crewState.source` to recover those two distinct captain-facing categories for the decisions inbox.

## Hono + Bun websocket gotcha

`hono/bun`'s `createBunWebSocket` reads the raw Bun `Server` back off `c.env.server`. `Bun.serve`'s `fetch` must be called as `(req, server) => app.fetch(req, { server })` - dropping the second arg makes every `/ws` upgrade 500 with `"server" in c.env is not an Object`. Applies to both `/ws` and `/ws/session`; both upgrade paths are same-origin guarded.

## Command deck (app-owned tmux session)

`server/src/tmux/*` is a from-scratch TS port of firstmate's `bin/fm-tmux-lib.sh` verified-submit + composer-idle detection (`composerState.ts`, `submit.ts`), plus a session manager (`sessionManager.ts`) and pane streamer (`paneStream.ts`). It talks to a tmux session THIS app creates and owns (deterministic name from `fmHome`, never a firstmate-tracked crewmate) via generic `send-keys`/`capture-pane`/`pipe-pane` - it does not call any `bin/fm-*.sh` script, so it sits outside the safety module's allowlist entirely; `server/src/composer/queue.ts` is the one busy-aware serialized send path everything funnels through. Read-only mode compares `state/.lock`'s pid against the app-owned session's own pane-process ancestry (`isLockHeldByOwnSession`) - never acquires the lock itself. `/ws/session` and command-deck POST routes are same-origin guarded. Two sharp edges found only by driving this in a real browser, not by unit tests: (1) `capture-pane -e` always returns the tmux pane's full configured height including trailing blank rows, so the xterm resync snapshot must trim them (`paneSnapshotToXterm`) or real content scrolls off-screen in a shorter browser viewport; (2) xterm.js needs a true fixed-width font for its cell metrics - a variable-width web font (e.g. Geist Mono Variable) throws off glyph spacing, so the terminal pins `ui-monospace, Menlo, Consolas, monospace` instead of the app's variable mono font. Integration tests spin up real tmux sessions (a fake Node composer harness fixture stands in for a real agent harness) - always killed in `afterEach`.

## TanStack Query networkMode gotcha

The `QueryClient` in `client/src/main.tsx` sets `networkMode: "always"`. This app is local-only (127.0.0.1); the browser's general online/offline detection has no bearing on whether the local FM Deck server is reachable, so the default `networkMode: "online"` would pause retries incorrectly (e.g. no wifi but localhost is still right there). Separately, and NOT something to "fix": TanStack Query also pauses retries when `document.visibilityState` is `"hidden"` (a backgrounded tab) regardless of `networkMode` - this is correct, intentional behavior, and is why a query stuck retrying in an automated/background browser tab can look permanently blank; it resolves once the tab is genuinely focused.

## Multi-home switcher (Phase 5)

`server/src/adapter/homes.ts` discovers homes read-only: the booted primary plus every home
registered in `data/secondmates.md` (no separate registry to invent or maintain).
`GET /api/fleet?home=<id>`, `GET /api/tasks/:id?home=<id>`, and `GET /ws?home=<id>` resolve
against that list (400 for an unknown id); `server/src/eventBus/homeChannels.ts` lazily keeps one
chokidar watcher + snapshot
broadcaster per distinct home path so a switched-home Bridge view gets its own live client set.
The Command Deck's app-owned tmux session always stays bound to the booted primary home - only
Bridge/task-detail views follow the switcher (`client/src/routing/useSelectedHome.ts`, persisted
to localStorage, not the URL, since it's a navigation convenience rather than fleet domain truth).

## FM_HOME must be an absolute path

`server/src/index.ts` rejects a relative `FM_HOME` at startup. `bun run --cwd server dev` (and
`--cwd client`) change the process's cwd before `index.ts` ever runs, so a relative `FM_HOME`
silently resolves against whichever workspace script started the server instead of the shell's own
cwd, and the app then serves an empty fleet snapshot with no error at all. Always pass an absolute
path (e.g. `FM_HOME="$PWD/server/test/fixtures/fm-home"`).

## One-command launch

`bun run start` runs `scripts/start.mjs` (plain JS, deliberately outside the three typed
workspaces and excluded from eslint/tsc in `eslint.config.js`'s ignores), which validates absolute
`FM_HOME`, checks the configured server port is available, then spawns `dev:server` and
`dev:client` together via `Bun.spawn`, forwarding SIGINT/SIGTERM to both.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
