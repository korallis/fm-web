# fm-web

**FM Deck** - a local-only web cockpit for firstmate.

Phase 1 is the Bridge dashboard: a read-only view over a firstmate home that builds a fleet
snapshot from validated disk state, serves it over REST, and pushes refreshed snapshots over a
WebSocket when `state/` or `data/` changes.

- Runs on 127.0.0.1 only (local, not exposed).
- Requires `FM_HOME`; no firstmate home path is hardcoded.
- Reads firstmate home state read-only; mutating scripts are refused in Phase 1.
- Shows supervision health, fleet tasks, backlog lanes, and project-mode chips.
- Does not yet include the composer, command deck, task detail terminals, decisions inbox, wake
  feed, or advanced drawer planned for later phases.

Stack: Bun workspaces, Hono server (REST + WebSocket), Vite + React 19 + Tailwind 4 client,
strict TypeScript.

## Workspaces

- `shared/` - dependency-free wire types and shared config helpers.
- `server/` - Bun + Hono server, firstmate disk adapter, chokidar watcher, guarded script runner.
- `client/` - Vite SPA for the Bridge dashboard.

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
- `GET /api/fleet` returns the current `FleetSnapshot`.
- `GET /ws` upgrades to a WebSocket and sends a `FleetSnapshot` on open and after debounced
  firstmate `state/` or `data/` changes.

## Safety

The adapter reads firstmate files defensively and does not write to `FM_HOME`. The guarded runner
allows only read-only scripts (`fm-peek.sh`, `fm-crew-state.sh`, `fm-project-mode.sh`,
`fm-review-diff.sh`, and `fm-lock.sh status`). All mutating scripts are refused in Phase 1;
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
