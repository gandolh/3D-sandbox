---
summary: Which question goes to which layer, and which skill handles which kind of work in this repo.
updated: 2026-09-11
---

# Routing

## Skills

| Intent | Skill |
|---|---|
| Implement a brief | `plan-split-dispatch` (≥3 independent chunks), else inline |
| Design not yet settled | `grill-me` |
| Frontend work on the shell | `impeccable`, against the Darkroom direction |
| UI walkthrough / audit | `ui-test-plans` |
| Audit for what to do next | `improve` |

## Knowledge routing

| Question shape | Layer |
|---|---|
| "Why is it like this?" | `wiki/decisions.md` |
| "What does this word mean here?" | `wiki/glossary.md` |
| "How does the pipeline fit together?" | `wiki/architecture.md` |
| "What is built / what is next?" | `wiki/status.md` |
| "Who calls X / what breaks if I change X?" | code graph — **not yet installed** |
| "Did I get *every* usage?" | `grep -rnw`, never the wiki |
| "Is this document valid?" | run the linter, never reason about it |

## READ / SKIP

**READ** — `packages/schema/src/`, `scenes/src/`, `corpus/wiki/`.
**SKIP** — `scenes/*.scene.json` (generated; read the builder instead),
`**/dist/`, `node_modules/`, `assets-src/`.

## Not yet set up

A code graph (`corpus-flow` §0b) is not installed. Worth adding once `apps/web`
exists and structural questions start costing real tokens; premature at this size.
