# Task 64 — `unique-ids` does not claim rooms or paving

## Context

From the 2026-09-20 audit. The rule's own doc comment predicts this bug and
names the last time it happened:

> Every id in a document must be unique, across every tier and entity kind. …
> **The list below is the claim, and it has to stay the whole list.** It used to
> say "every tier and entity kind" while omitting `subject.runs` and
> `animation.tracks`, so two runs could share an id …

The list in `packages/schema/src/lint/rules/identity.ts` claims: levels, walls,
openings, slabs, roofs, placements, runs, scatter, masses, roads, shots and
animation tracks. It does **not** claim `level.rooms` or `context.paving`, both
of which carry an `id` (`packages/schema/src/document.ts:115` and `:321`). Those
two entity kinds arrived after the comment was written, which is precisely the
failure mode the comment describes.

**Verified by execution during the audit**: a level with two rooms both id'd
`W-03` — also the id of a wall on that level — and two paving areas both id'd
`court` produces **zero** `unique-ids` findings. `resolveEntities` then attaches
the rooms' findings to whatever else holds the id: both room warnings come back
with `entities: ["L1","W-03"]`, so selecting wall `W-03` in the Inspector shows
two "bed has no window" warnings that belong to rooms, and the rooms themselves
are unreachable from the tree.

A collision here is not cosmetic for the same reasons the comment already gives:
ids appear in linter messages and in the editor's selection state, `findMesh`
can only ever select one of two, and `SceneTree` renders duplicate React keys.

## Files you OWN

- `packages/schema/src/lint/rules/identity.ts`
- `packages/schema/test/lint.test.ts`

## Files you must NOT touch

- `packages/schema/src/document.ts` — `Room` and `Paving` having ids is correct.
- `resolveEntities` — it behaves correctly given unique ids; the defect is
  upstream of it.

## What to do

1. Add `level.rooms` and `context.paving` to the claim list, with paths matching
   the existing convention (`subject.levels[i].rooms[j]`, `context.paving[i]`).
2. **Make the next omission impossible to add silently**, because this is now the
   second time. The list is a hand-maintained enumeration of entity kinds, which
   is the same shape of hazard as brief 24's hand-listed cache key. Options worth
   weighing, in the brief's judgement:
   - walk the document generically for objects carrying an `id`, so a new entity
     kind participates automatically; or
   - a test that enumerates every `id`-bearing type in the schema and fails when
     one is not claimed — the same trick the `FIRES` registry already plays for
     lint rules.
   Prefer whichever you can make **fail loudly when a new id-bearing entity is
   added**. Write down which you chose and why in the rule's comment.
3. Add tests that the rule fires for a duplicate room id and a duplicate paving
   id specifically — not just that it fires for something.

## Acceptance

- A document with two rooms sharing an id produces a `unique-ids` error; same for
  paving.
- Adding a new `id`-bearing entity kind to the schema without claiming it causes
  a test to fail (or the rule to cover it automatically).
- The tests fail if the new entries are removed — verify by mutation.
- `npm run check` exits 0.
