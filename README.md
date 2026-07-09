# fm-web

**FM Deck** - a local-only web cockpit for firstmate.

FM Deck includes the Command Deck (composer + live terminal), the Bridge dashboard, task detail
views, a Cmd+K command palette, captain-relevant notifications, and a multi-home switcher. It
builds fleet and task snapshots from validated firstmate disk state, serves them over REST, and
pushes refreshed snapshots over a WebSocket when `state/` or `data/` changes.

- Runs on 127.0.0.1 only (local, not exposed).
- Requires `FM_HOME`, set to an **absolute** path to a firstmate home (a relative path resolves
  differently depending on which workspace script starts the server - see Configuration).
- Requires `tmux` for the Command Deck runtime and for the real-session server tests.
- Reads firstmate home state read-only; Command Deck writes are limited to tmux operations
  (send-keys/capture-pane/pipe-pane) against a tmux session it created itself plus an app-owned
  pipe log under OS temp - never a firstmate script, never firstmate-tracked state.
- Shows supervision health, decisions inbox, fleet tasks, backlog lanes, a wake feed split into
  surfaced (escalated) vs. absorbed (benign, watcher-filtered) events, project-mode chips,
  secondmates, X-mode relay links, and per-task detail (Bridge), plus the live composer/terminal
  (Command Deck).
- A home switcher lets the Bridge and task-detail views read any discovered firstmate home - the
  booted primary plus every registered secondmate home - while the Command Deck's app-owned
  session always stays bound to the booted primary home.
- Cmd+K (Ctrl+K) opens a command palette: switch tabs, switch home, open a task, interrupt the
  session, enable notifications.
- Newly-appeared captain-relevant decisions raise an in-app toast, plus a browser Notification
  when permission is granted (so a backgrounded tab still surfaces it). The first snapshot in each
  selected home is treated as the notification baseline.
- Fleet task cards open `?task=<id>` detail URLs within the selected home; the selected home itself
  is a browser-local preference, not part of the URL. Closing the detail view returns to the Bridge.
- Task detail shows brief/report markdown, PR and merge-poll status, no-mistakes gate findings,
  and a `.status` history timeline that is explicitly not current-state truth.
- Does not yet include interactive reply actions or mutating advanced drawer actions planned for
  later phases.

Stack: Bun workspaces, Hono server (REST + WebSocket), Vite + React 19 + Tailwind 4 client,
@xterm/xterm response terminal, strict TypeScript.

## Workspaces

- `shared/` - dependency-free wire types and shared config helpers.
- `server/` - Bun + Hono server, firstmate disk adapter, chokidar watcher, guarded script runner,
  the app-owned tmux session manager + verified-submit composer queue.
- `client/` - Vite SPA: the Command Deck (composer + response terminal), Bridge dashboard, task
  detail view, command palette, and notifications.

## Run Locally

One command brings up both the server and the client dev server together, after checking that
`FM_HOME` is absolute and the configured server `PORT` is free:

```sh
$HOME/.bun/bin/bun install
FM_HOME="$PWD/server/test/fixtures/fm-home" FM_DECK_HARNESS_CMD="bash" $HOME/.bun/bin/bun run start
```

Use the sanitized fixture home for development and tests, and set `FM_DECK_HARNESS_CMD` to
something harmless (not `claude`) unless you want the Command Deck to actually spawn a billed
session. `FM_HOME` must be absolute - `$PWD/...` above, or a real firstmate home's absolute path.

To run the two halves separately instead:

```sh
FM_HOME="$PWD/server/test/fixtures/fm-home" FM_DECK_HARNESS_CMD="bash" $HOME/.bun/bin/bun run dev:server
$HOME/.bun/bin/bun run dev:client
```

The server defaults to `http://127.0.0.1:4870`. The client dev server also binds to
`127.0.0.1` and proxies `/api`, `/ws`, and `/ws/session` to the server.

## Configuration

Server:

- `FM_HOME` - required, **absolute** path to a firstmate home root.
- `PORT` - optional server port, defaults to `4870`.
- `FM_DECK_HARNESS_CMD` - command run inside the app-owned first-mate session, defaults to `claude`.
- `FM_CAPTAIN_RE` - optional case-insensitive classifier regex override.
- `FM_POLL`, `FM_GUARD_GRACE`, `FM_HEARTBEAT`, `FM_HEARTBEAT_MAX`,
  `FM_STALE_ESCALATE_SECS`, `FM_CHECK_INTERVAL` - optional supervision timing overrides.

Client:

- `FM_SERVER_URL` - optional full server URL for the Vite proxy.
- `FM_SERVER_PORT` - optional server port for the Vite proxy when `FM_SERVER_URL` is unset.

Composer drafts, prompt history, and the selected home id live in the browser's `localStorage`
(namespaced per `fmHome`/home id where relevant), never on disk under a firstmate home.

## API

- `GET /api/health` returns `{ ok, fmHome }`.
- `GET /api/homes` returns `{ commandDeckHomeId, homes }` - the booted primary plus every home
  registered in `data/secondmates.md`, deduplicated by resolved path.
- `GET /api/fleet?home=<id>` returns the current `FleetSnapshot` for a discovered home id
  (`"primary"` or a secondmate id; omit for the primary), including tasks, backlog, projects,
  secondmates, supervision health, decisions, wake-queue entries, and watch-triage entries. `400`
  for an unknown home id.
- `GET /api/tasks/:id?home=<id>` returns a `TaskDetail` for one safe task id in the given home,
  `400` for an unsafe id or unknown home id, and `404` when `state/<id>.meta` does not exist.
- `GET /ws?home=<id>` upgrades to a WebSocket and sends a `FleetSnapshot` for that home on open
  and after debounced firstmate `state/` or `data/` changes; `400` for an unknown home id and `403`
  for cross-origin upgrades.
- `GET /api/skills` returns runtime-discovered skills (`.claude/skills` + `.agents/skills`);
  duplicate ids prefer `.claude`, and only `user-invocable: true` skills appear as quick actions.
- `GET /api/composer/state` returns the current `ComposerState` (busy/read-only/lock/queue).
- `POST /api/composer/send` with `{ text }` enqueues a prompt on the busy-aware verified-submit
  queue; `200` when accepted, `409` when rejected (read-only or unavailable), `400` for a
  malformed body, `403` for cross-origin requests.
- `POST /api/session/interrupt` sends Ctrl-C to the app-owned session (a no-op returning
  `{ sent: false }` when read-only or unavailable, `403` for cross-origin requests).
- `GET /ws/session` upgrades to a WebSocket streaming `SessionWsMessage`s: an initial `snapshot` of
  the visible pane, live `chunk`s of new pane output, and `composerState` updates. Cross-origin
  upgrades are rejected with `403`. Always bound to the booted primary home's Command Deck session.

## Safety

The adapter reads firstmate files defensively and does not write to `FM_HOME`. The guarded runner
allows only read-only scripts (`fm-peek.sh`, `fm-crew-state.sh`, `fm-project-mode.sh`,
`fm-review-diff.sh`, and `fm-lock.sh status`). Task detail may also run bounded, read-only
`no-mistakes axi status` in a ship task's existing worktree, separate from the firstmate script
allowlist, to display raw gate status. All mutating scripts are refused categorically;
`fm-session-start.sh`, `fm-wake-drain.sh`, and bare or acquire-style `fm-lock.sh` calls are
always refused. The Command Deck's composer never calls any firstmate script at all - it drives its own
app-owned tmux session directly (send-keys/capture-pane/pipe-pane), the same way a human typing in
a terminal would, and degrades to read-only whenever `state/.lock` is held by a live session other
than its own. The home switcher only ever selects among homes discovered read-only from the
booted primary plus `data/secondmates.md` - never an arbitrary filesystem path.

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
