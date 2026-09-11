---
summary: Dated snapshot of what is built, what is in flight, and what is next — the living dashboard.
updated: 2026-09-11
---

# Status

_Snapshot: 2026-09-11_

## Where things stand

Design is fully settled ([decisions.md](./decisions.md)) and the foundation layer
is built. `packages/schema` defines the scene document, validates it, and lints it
semantically; `scenes/` holds the first authored scene, which round-trips through
the builder into canonical JSON and passes the linter.

Nothing renders yet. No `apps/web`, no `apps/api`.

## Briefs

| # | Brief | State |
|---|---|---|
| 01 | [Scene document schema and linter](../briefs/done/01-schema-and-linter.md) | done |

## Next

In the agreed sequence — document model → editor and viewport → solar time →
path-traced render → physics — the next slice is the **geometry generator**
(document → three.js meshes, openings cut with `three-bvh-csg`), followed by the
`apps/web` shell in the Darkroom direction.

Known constraint, already surfaced: the scene tree, inspector and timeline each
need an independent scroll container (`@base-ui/react` Scroll Area) from the first
commit of the shell, not retrofitted once panels start clipping.
