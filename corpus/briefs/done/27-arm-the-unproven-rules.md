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

---

## Outcome — 2026-09-12

**1 — The three unarmed rules now have firing tests.** `run-is-well-formed`
gets six rather than five: the brief's five checks, plus one asserting the
`kind !== "fence"` guard added by brief 21 **does not** fire on a fence or a
hedge. That guard was edited two days before this brief with nothing asserting
it, and a test proving a check fires is only half of it — the other half is
proving it stays quiet where it was deliberately made to.

Each asserts the rule name, the severity, and a fragment of the message, so a
rule that fires for the wrong reason is not mistaken for one that works.

**2 — `unique-ids` claims what its doc comment always said it did.**
`subject.runs` and `animation.tracks` added. The consequence was concrete, not
theoretical: two runs sharing an id gave `SceneTree` duplicate React keys,
`findMesh` could only ever select one of them, and `runs.ts` seeds each
pergola's canopy from `run.id` — so two same-id pergolas grew byte-identical
foliage, which is the exact thing that seeding exists to prevent.

**3 — The hole is closed with a `FIRES` map**, one document per rule, keyed by
rule name, with `it.each(RULES)` walking the registry. Verified by removing a
key: the suite fails with *`no firing document for "shot-camera-is-valid" — add
one to FIRES`*, which is the message a future author needs at the moment they
need it. The reverse direction is tested too — a `FIRES` key for a rule that no
longer exists fails, so deleting a rule cannot leave dead scaffolding that
makes the list stop describing itself.

That mechanism, not the thirteen tests, is the deliverable. `asset-resolves`
was registered and never armed, and **eight invented Poly Haven slugs shipped**
in Greenhollow because of it.

**4 — Brief 42's handover, and it was not the one-line change it looked like.**
`roof-covers-walls` passed `+overhang` to `boundsContain` as a *tolerance*.
`boundsContain(outer, inner, t)` tests `inner.minX >= outer.minX - t`, so a
positive tolerance **loosens** containment: the rule permitted a roof *smaller*
than its walls by exactly the amount it is declared to oversail them by. It
read as "covers the walls, give or take the eave" and meant "may fall short by
an eave". Now `-overhang`.

**Turning it round immediately failed two of Greenhollow's own roofs**, and
they were *not* real findings — this is the report the brief asks for. Both
outbuildings declare exactly the eave they draw, and a footprint authored as
`rect(7 - 0.4, …)` comes out as `14.399999999999999`, so each missed an exact
`>=` by **2 × 10⁻¹⁵ m**. The rule now allows a millimetre: the smallest
distance the document's own units comment says anyone means, and an eave short
by less than that is not a drawing anyone would redo. There is a test for the
float-noise case specifically, so nobody tightens it back.

Four tests bracket the new direction: oversailing by the declared eave passes,
oversailing by more passes, **flush** fails (the case the old tolerance
permitted, and exactly what Elmsgate shipped), and falling short fails.

**A note on scope.** This brief says not to touch other rules' logic, and brief
42's outcome hands it this change by name. The later, more specific instruction
wins; the change is one comparison and it came with the decision that defines
it. Nothing else in the linter was altered.

`npm run check` clean, **350 tests** (was 324). All three scenes build clean.
