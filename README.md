# fm-web

**FM Deck** - a local-only web cockpit for firstmate.

FM Deck currently includes the Bridge dashboard plus a read-only task detail view. It builds
fleet and task snapshots from validated firstmate disk state, serves them over REST, and pushes
refreshed fleet snapshots over a WebSocket when `state/` or `data/` changes.

- Runs on 127.0.0.1 only (local, not exposed).
- Requires `FM_HOME`; no firstmate home path is hardcoded.
- Reads firstmate home state read-only; mutating scripts are refused.
- Shows supervision health, decisions inbox, fleet tasks, backlog lanes, wake feed,
  project-mode chips, and per-task detail.
- Task detail shows brief/report markdown, PR and merge-poll status, no-mistakes gate findings,
  and a `.status` history timeline that is explicitly not current-state truth.
- Fleet task cards open shareable `?task=<id>` detail URLs; closing the detail view returns to
  the Bridge.
- Does not yet include the composer, command deck, live task terminals, interactive reply actions,
  or mutating advanced drawer actions planned for later phases.

Stack: Bun workspaces, Hono server (REST + WebSocket), Vite + React 19 + Tailwind 4 client,
strict TypeScript.

## Workspaces

- `shared/` - dependency-free wire types and shared config helpers.
- `server/` - Bun + Hono server, firstmate disk adapter, chokidar watcher, guarded script runner.
- `client/` - Vite SPA for the Bridge dashboard and task detail view.

## Run Locally

Use the sanitized fixture home for development and tests:

```sh
$HOME/.bun/bin/bun install
FM_HOME=server/test/fixtures/fm-home $HOME/.bun/bin/bun run dev:server
$HOME/.bun/bin/bun run dev:client
```

The server defaults to `http://127.0.0.1:4870`. The client dev server also binds to
`127.0.0.1` and proxies `/api` and `/ws` to the server.

## Configuration

Server:

- `FM_HOME` - required firstmate home root.
- `PORT` - optional server port, defaults to `4870`.
- `FM_CAPTAIN_RE` - optional case-insensitive classifier regex override.
- `FM_POLL`, `FM_GUARD_GRACE`, `FM_HEARTBEAT`, `FM_HEARTBEAT_MAX`,
  `FM_STALE_ESCALATE_SECS`, `FM_CHECK_INTERVAL` - optional supervision timing overrides.

Client:

- `FM_SERVER_URL` - optional full server URL for the Vite proxy.
- `FM_SERVER_PORT` - optional server port for the Vite proxy when `FM_SERVER_URL` is unset.

## API

- `GET /api/health` returns `{ ok, fmHome }`.
- `GET /api/fleet` returns the current `FleetSnapshot`, including tasks, backlog, projects,
  secondmates, supervision health, decisions, wake-queue entries, and watch-triage entries.
- `GET /api/tasks/:id` returns a `TaskDetail` for one safe task id, `400` for unsafe ids, and
  `404` when `state/<id>.meta` does not exist.
- `GET /ws` upgrades to a WebSocket and sends a `FleetSnapshot` on open and after debounced
  firstmate `state/` or `data/` changes.

## Safety

The adapter reads firstmate files defensively and does not write to `FM_HOME`. The guarded runner
allows only read-only scripts (`fm-peek.sh`, `fm-crew-state.sh`, `fm-project-mode.sh`,
`fm-review-diff.sh`, and `fm-lock.sh status`). Task detail may also run bounded, read-only
`no-mistakes axi status` in a ship task's existing worktree, separate from the firstmate script
allowlist, to display raw gate status. All mutating scripts are refused;
`fm-session-start.sh`, `fm-wake-drain.sh`, and bare or acquire-style `fm-lock.sh` calls are
always refused.

## Validation

```sh
$HOME/.bun/bin/bun run typecheck
$HOME/.bun/bin/bun run lint
$HOME/.bun/bin/bun run format
$HOME/.bun/bin/bun run test
$HOME/.bun/bin/bun run build
```
