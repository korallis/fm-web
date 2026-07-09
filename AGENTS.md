# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## Layout

Bun workspaces: `shared/` (wire types, no runtime deps), `server/` (Bun + Hono, strict TS), `client/` (Vite + React 19 + Tailwind 4). Full architecture and phase plan: `/Users/leebarry/fm/firstmate/data/fm-web-plan.md` (captain-owned, outside this repo).

## Build/test

`bun install`, `bun run typecheck` / `lint` / `format` / `test` / `build` at the repo root fan out to all three workspaces. `bun` is not on PATH by default in some shells here - use `$HOME/.bun/bin/bun` or `export PATH="$HOME/.bun/bin:$PATH"` first.

## FM adapter + safety module

`server/src/adapter/*` parses the Phase 1 firstmate formats (meta/status/wake-queue/lock/beacon/.afk/backlog/projects/secondmates/crew-state grammar, plus Phase 4's watch-triage log) read-only; brief/report helpers are path-only for now. `server/src/safety/{allowlist,scriptRunner}.ts` is the one guarded-execution gate - read the safety contract in the plan above before touching either. Tests run against the sanitized fixture home at `server/test/fixtures/fm-home/` - NEVER point tests or dev at a live firstmate home.

`fm-crew-state.sh`'s `parked` state is ambiguous on its own: `source: run-step` means a no-mistakes gate is awaiting approval, while any other source means the log fallback mapped a manual `needs-decision:` status append to `parked` for display (see the reference script's `map_log_state()`). `server/src/adapter/decisions.ts` splits on `crewState.source` to recover those two distinct captain-facing categories for the decisions inbox.

## Hono + Bun websocket gotcha

`hono/bun`'s `createBunWebSocket` reads the raw Bun `Server` back off `c.env.server`. `Bun.serve`'s `fetch` must be called as `(req, server) => app.fetch(req, { server })` - dropping the second arg makes every `/ws` upgrade 500 with `"server" in c.env is not an Object`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
