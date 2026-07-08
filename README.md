# fm-web

**FM Deck** - a local-only web cockpit for firstmate.

Prompt the first-mate agent from a busy-aware composer over an app-owned session, backed by a
live fleet dashboard built from validated disk state, a decisions inbox, a wake feed, and a
clearly-marked advanced drawer that drives the same `bin/fm-*.sh` scripts the agent uses -
never bypassing firstmate's safety contract.

- Runs on 127.0.0.1 only (local, not exposed).
- Reads firstmate home state read-only; mutations go through firstmate's own scripts / `tasks-axi`.
- Never modifies firstmate; reads formats defensively so `/updatefirstmate` keeps working.

Stack: Bun + Hono server (REST + WebSocket) · Vite + React + Tailwind + xterm.js SPA · strict TS.

> Scaffolding and all feature work land through the review/test/CI pipeline as PRs.
