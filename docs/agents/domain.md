# Domain docs layout: single-context

This repository uses a single-context layout:

- `CONTEXT.md` (when present) lives at the repo root and captures project-wide terminology, conventions, and invariants.
- ADRs live in `docs/adr/`.
- Agent skills read `CONTEXT.md` first, then the most recent ADR that touches the topic being discussed.

No `CONTEXT-MAP.md` is present; this is not a monorepo.