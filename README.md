# fm-web

**FM Deck** - a local-only web cockpit for firstmate.

FM Deck includes the Bridge dashboard, a read-only task detail view, and the Command Deck. It builds
fleet and task snapshots from validated firstmate disk state, serves them over REST, and pushes
refreshed fleet snapshots over a WebSocket when `state/` or `data/` changes.

Phase 2 adds the Command Deck: an app-owned tmux session running the first-mate harness, a
busy-aware verified-submit composer, an xterm.js response terminal streaming that session live,
lock-aware read-only mode, and runtime-discovered skill quick-actions. The Command Deck is the
default tab; Bridge is still there alongside it.

- Runs on 127.0.0.1 only (local, not exposed).
- Requires `FM_HOME`; no firstmate home path is hardcoded.
- Reads firstmate home state read-only; the only writes this app ever makes are tmux operations
  (send-keys/capture-pane/pipe-pane) against a tmux session it created itself - never a firstmate
  script, never firstmate-tracked state.
- Shows supervision health, decisions inbox, fleet tasks, backlog lanes, wake feed,
  project-mode chips, and per-task detail (Bridge), plus the live composer/terminal (Command Deck).
- Task detail shows brief/report markdown, PR and merge-poll status, no-mistakes gate findings,
  and a `.status` history timeline that is explicitly not current-state truth.
- Fleet task cards open shareable `?task=<id>` detail URLs; closing the detail view returns to
  the Bridge.
- Does not yet include live task terminals, interactive reply actions, or mutating advanced drawer
  actions planned for later phases.

Stack: Bun workspaces, Hono server (REST + WebSocket), Vite + React 19 + Tailwind 4 client,
@xterm/xterm response terminal, strict TypeScript.

## Workspaces

- `shared/` - dependency-free wire types and shared config helpers.
- `server/` - Bun + Hono server, firstmate disk adapter, chokidar watcher, guarded script runner,
  the app-owned tmux session manager + verified-submit composer queue.
- `client/` - Vite SPA: the Command Deck (composer + response terminal), Bridge dashboard, and
  task detail view.

## Run Locally

Use the sanitized fixture home for development and tests. Set `FM_DECK_HARNESS_CMD` to something
harmless (not `claude`) unless you want the Command Deck to actually spawn a billed session:

```sh
$HOME/.bun/bin/bun install
FM_HOME=server/test/fixtures/fm-home FM_DECK_HARNESS_CMD="bash" $HOME/.bun/bin/bun run dev:server
$HOME/.bun/bin/bun run dev:client
```

The server defaults to `http://127.0.0.1:4870`. The client dev server also binds to
`127.0.0.1` and proxies `/api`, `/ws`, and `/ws/session` to the server.

## Configuration

Server:

- `FM_HOME` - required firstmate home root.
- `PORT` - optional server port, defaults to `4870`.
- `FM_DECK_HARNESS_CMD` - command run inside the app-owned first-mate session, defaults to `claude`.
- `FM_CAPTAIN_RE` - optional case-insensitive classifier regex override.
- `FM_POLL`, `FM_GUARD_GRACE`, `FM_HEARTBEAT`, `FM_HEARTBEAT_MAX`,
  `FM_STALE_ESCALATE_SECS`, `FM_CHECK_INTERVAL` - optional supervision timing overrides.

Client:

- `FM_SERVER_URL` - optional full server URL for the Vite proxy.
- `FM_SERVER_PORT` - optional server port for the Vite proxy when `FM_SERVER_URL` is unset.

Composer drafts and prompt history live in the browser's `localStorage` (namespaced per `fmHome`),
never on disk under a firstmate home.

## API

- `GET /api/health` returns `{ ok, fmHome }`.
- `GET /api/fleet` returns the current `FleetSnapshot`, including tasks, backlog, projects,
  secondmates, supervision health, decisions, wake-queue entries, and watch-triage entries.
- `GET /api/tasks/:id` returns a `TaskDetail` for one safe task id, `400` for unsafe ids, and
  `404` when `state/<id>.meta` does not exist.
- `GET /ws` upgrades to a WebSocket and sends a `FleetSnapshot` on open and after debounced
  firstmate `state/` or `data/` changes.
- `GET /api/skills` returns runtime-discovered skills (`.claude/skills` + `.agents/skills`).
- `GET /api/composer/state` returns the current `ComposerState` (busy/read-only/lock/queue).
- `POST /api/composer/send` with `{ text }` enqueues a prompt on the busy-aware verified-submit
  queue; `200` when accepted, `409` when rejected (read-only or unavailable), `400` for a
  malformed body.
- `POST /api/session/interrupt` sends Ctrl-C to the app-owned session (a no-op returning
  `{ sent: false }` when read-only or unavailable).
- `GET /ws/session` upgrades to a WebSocket streaming `SessionWsMessage`s: an initial `snapshot` of
  the visible pane, live `chunk`s of new pane output, and `composerState` updates.

## Safety

The adapter reads firstmate files defensively and does not write to `FM_HOME`. The guarded runner
allows only read-only scripts (`fm-peek.sh`, `fm-crew-state.sh`, `fm-project-mode.sh`,
`fm-review-diff.sh`, and `fm-lock.sh status`). Task detail may also run bounded, read-only
`no-mistakes axi status` in a ship task's existing worktree, separate from the firstmate script
allowlist, to display raw gate status. All mutating scripts are refused;
`fm-session-start.sh`, `fm-wake-drain.sh`, and bare or acquire-style `fm-lock.sh` calls are
always refused. The Command Deck's composer never calls any firstmate script at all - it drives its own
app-owned tmux session directly (send-keys/capture-pane/pipe-pane), the same way a human typing in
a terminal would, and degrades to read-only whenever `state/.lock` is held by a live session other
than its own.

## Validation

```sh
$HOME/.bun/bin/bun run typecheck
$HOME/.bun/bin/bun run lint
$HOME/.bun/bin/bun run format
$HOME/.bun/bin/bun run test
$HOME/.bun/bin/bun run build
```

Server tests that exercise the app-owned session use real `tmux` (required) against throwaway
session names, always cleaned up in `afterEach`.
