# Task 38 — Three tests that cannot catch what they were written for

## Context

From the 2026-09-12 audit, round 4. The suite is unusually disciplined overall —
real Fastify apps against real temp directories, physics and solar numbers pinned
to independently derivable facts, and `vi.mock` used exactly once, at a boundary.
These three are the exceptions, and one of them is actively harmful.

**1 — A test that pins a live bug in place.**
`packages/physics/test/colliders.test.ts:166` asserts a placement collider's
`rotationY` equals the document's raw **degrees** value:

```ts
expect(placement.rotationY).toBe(30);
```

`colliders.ts:70` copies degrees into a field both consumers read as radians (see
brief 22). This is the **only** test in the suite exercising a non-zero placement
rotation — every rotation in `world.test.ts` is 0 — so it is the single thing
standing between the bug and a red build. Applying the one-line fix brief 22
specifies makes this test fail. That is why the bug shipped with `npm run check`
green: the suite is not silent about it, it actively asserts it.

**2 — A success path with no coverage, tested only through its failure.**
`apps/web/test/asset-loader.test.ts` — all five tests assert `toBeUndefined()`.
The one named for the document→library material-id mapping stubs an index with
`materials: []`, so `libraryMaps` is empty and `source.maps(id)` returns
`undefined` **regardless of whether the key is built correctly**. Break the
formula at `AssetLoader.ts:130` — swap it to `` `${slug}/${source}` ``, or return
an accessor that always yields undefined — and the test still passes.

Nothing anywhere in the repo populates a matching model, impostor or material and
checks that `loadAssets` returns something real. The whole interesting half of
the module — triangle-count gating, colour-space assignment, id mapping — is
untested.

**3 — A vacuously true test.**
`packages/physics/test/colliders.test.ts:121`:

```ts
expect(deriveColliders(baseScene()).some((c) => c.id.startsWith("roof"))).toBe(false);
```

`colliders.ts` never mentions `doc.subject.roofs` at all, so this cannot fail from
any logic the function has. It also matches on an **id prefix** where its
neighbour two lines down correctly matches on `source === "mass"` — so a roof
collider added under any id not literally beginning `roof` would slip past the
guard the test exists to be.

## Files you OWN

- `packages/physics/test/colliders.test.ts`
- `apps/web/test/asset-loader.test.ts`

## Files you must NOT touch

- `packages/physics/src/colliders.ts` — **brief 22 owns that fix.** This brief
  owns the test that blocks it. Do them in either order, but do not fix the
  source here, or the two briefs collide.

## What to do

1. **Fix the rotation assertion to express the requirement, not the current
   output**: assert the collider's yaw equals the yaw the geometry generator
   applies to the same placement — `degToRad(30)` — so it fails today and passes
   after brief 22. A test written against the bug is worse than no test.
2. **Give `asset-loader` a real success path**: stub an index containing a model,
   an impostor and a material, and assert that a document material id resolves to
   the expected maps, that a too-heavy model is gated, and that colour space is
   assigned per map role. That is where the logic lives.
3. **Make the roof test able to fail** — assert on the collider `source`, the way
   the mass test does — or delete it and say why in the commit. A test that
   documents intent it cannot enforce is a comment wearing a costume.

## Acceptance

- No test in the suite asserts a value that the source is known to produce
  wrongly.
- `AssetLoader`'s mapping is covered by a test that fails when the key formula
  changes.
- `npm run check` exits 0 (with brief 22 applied, or with the test written to
  fail until it is — say which in the outcome note).

---

## Outcome — 2026-09-12

**1 — Already done, by brief 22.** The `expect(placement.rotationY).toBe(30)`
assertion is gone; `colliders.test.ts` now asserts `toBeCloseTo(degToRad(30))`
and, beside it, turns the yaw back into a **direction** — a quarter turn must
send the box's local +X axis to −Z — rather than comparing against the same
function the implementation calls. Recorded here so the brief's first item is
closed rather than silently skipped.

**2 — The vacuous roof test is now one that can fail.** It matched on an id
prefix against a function that never mentions `doc.subject.roofs`, so it could
not fail from any logic `deriveColliders` has — and a roof collider added under
an id not literally beginning "roof" would slip straight past the guard.

Rewritten to **add a roof and count**: build the colliders, add a real gable
roof to the document, and assert the count is unchanged. That is a claim about
the function's inputs, which is the claim the test was trying to make. Matching
on `source` — the brief's other suggestion — was rejected because `"roof"` is
not in the `source` union, so the assertion would have needed a cast to say
anything, and a test that needs a cast to express its own premise is halfway
back to where this started.

**3 — `AssetLoader` has a success path now.** The old mapping test stubbed
`materials: []`, so `maps("wall")` was undefined **whatever the key formula
did**. It is kept, honestly retitled *"yields no maps when the library holds
none"*, and five real tests added:

- a model carrying geometry is admitted, with its measured size;
- a glTF that parses but carries **no mesh** is gated out — not a failure path,
  the file loads fine, and letting it in replaces a visible proxy with nothing;
- colour space per **role**: `map` → sRGB, `normalMap` and `roughnessMap` →
  `NoColorSpace`, because normal and roughness are data and sRGB-decoding them
  makes surfaces subtly wrong in a way nobody traces back to the loader;
- the key formula, with a **decoy**: a second document material spelled
  `source: "clay_plaster", slug: "polyhaven"`, which is the one that would
  resolve if the formula were reversed. `wall` defined, `decoy` undefined;
- an impostor atlas and its metadata loading together, including mipmaps off
  and clamp wrapping.

**Verified by mutation, not by inspection.** Swapping line 172 to
`` `${slug}/${source}` `` — the brief's exact example — turns **three** tests
red. Before this brief it turned none red. That is the measurement the brief
was asking for, and it is the only way to know a test of this kind holds
weight.

`npm run check` clean, **355 tests** (was 350).
