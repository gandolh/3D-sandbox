# Task 27 — Four lint rules that read as complete and are not

## Context

From the 2026-09-12 audit. This project has already been burned by exactly this,
once, expensively: `asset-resolves` was registered in `RULES` and never actually
armed, so **eight invented Poly Haven slugs shipped** in Greenhollow. That is
recorded in `decisions-scene.md`. The same shape is still present in four places.

**Three of thirteen rules have no test that proves they fire.** Enumerated by
comparing `RULES` (`packages/schema/src/lint/index.ts:20`) against every rule name
asserted in `packages/schema/test/`:

| Rule | Proven to fire? |
|---|---|
| `run-is-well-formed` | **no** |
| `polygons-have-area` | **no** |
| `shot-camera-is-valid` | **no** |

The remaining ten are. The fixture tests prove a *good* document stays quiet,
which is not the same thing — a rule that can never fire also stays quiet.

`run-is-well-formed` matters most of the three: it has five separate checks, and
one of them was **edited two days ago** (brief 21 added the `kind !== "fence"`
guard) with nothing asserting any of them still work.

**And a fourth: `unique-ids` is incomplete.** Its doc comment
(`packages/schema/src/lint/rules/identity.ts:12`) says ids must be unique "across
every tier and entity kind", and it claims levels, walls, openings, slabs, roofs,
placements, scatter, masses, roads and shots — but **not `subject.runs`**, and not
`animation.tracks`. Two runs may share an id today. Downstream: `SceneTree`
renders duplicate React keys, `findMesh` can only ever select one of them, and
`runs.ts:191` seeds the canopy RNG from `run.id`, so two same-id pergolas get
byte-identical foliage — which that seeding exists specifically to prevent.

## Files you OWN

- `packages/schema/src/lint/rules/identity.ts`
- `packages/schema/test/lint.test.ts`

## Files you must NOT touch

- The other rules' logic. This brief arms tests and closes one coverage hole in
  `unique-ids`; it is not a rewrite of the linter.
- `scenes/` — if arming a rule turns up a real finding in a bundled scene, **stop
  and report it** rather than editing the scene inside this brief. That is a
  separate finding and deserves its own record.

## What to do

1. **One firing test per unproven check.** `run-is-well-formed` has five
   (repeated point, narrow span, spacing larger than the run, short pergola,
   climber on a non-pergola) — each gets a document that trips it and an assertion
   on rule name *and* severity. Then `polygons-have-area` and
   `shot-camera-is-valid`.
2. **Make `unique-ids` claim `subject.runs` and `animation.tracks`**, and test
   that a duplicate run id is an error.
3. **Close the hole permanently.** Add a test that walks `RULES` and fails if any
   registered rule has no firing test — a list that cannot silently grow a
   thirteenth unarmed member. Whatever mechanism you pick (a naming convention, an
   explicit registry in the test), it must fail when someone adds a rule and
   forgets the test, because that is the actual failure mode here.

## Acceptance

- Every rule in `RULES` has at least one test proving it fires.
- A duplicate `run` id is an error.
- Adding a new rule without a firing test fails the suite.
- `npm run check` exits 0.
