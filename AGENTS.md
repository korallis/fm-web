# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## Layout

Bun workspaces: `shared/` (wire types, no runtime deps), `server/` (Bun + Hono, strict TS), `client/` (Vite + React 19 + Tailwind 4). Full architecture and phase plan: `/Users/leebarry/fm/firstmate/data/fm-web-plan.md` (captain-owned, outside this repo).

## Build/test

`bun install`, `bun run typecheck` / `lint` / `format` / `test` / `build` at the repo root fan out to all three workspaces. `bun` is not on PATH by default in some shells here — use `$HOME/.bun/bin/bun` or `export PATH="$HOME/.bun/bin:$PATH"` first.

## FM adapter + safety module

`server/src/adapter/*` parses every on-disk firstmate format (meta/status/wake-queue/lock/beacon/backlog/projects/secondmates/crew-state grammar) read-only; `server/src/safety/{allowlist,scriptRunner}.ts` is the one guarded-execution gate — read the safety contract in the plan above before touching either. Tests run against the sanitized fixture home at `server/test/fixtures/fm-home/` — NEVER point tests or dev at a live firstmate home.

## Hono + Bun websocket gotcha

`hono/bun`'s `createBunWebSocket` reads the raw Bun `Server` back off `c.env.server`. `Bun.serve`'s `fetch` must be called as `(req, server) => app.fetch(req, { server })` — dropping the second arg makes every `/ws` upgrade 500 with `"server" in c.env is not an Object`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
