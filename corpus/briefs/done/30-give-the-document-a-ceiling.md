# Task 30 — A document can ask for more geometry than any machine has

## Context

From the 2026-09-12 audit, round 2.

**These documents are AI-authored.** A misplaced exponent is not an exotic
adversarial case here; it is the expected failure. And there is currently nothing
between a bad number and the GPU.

**1 — The only volume guard cannot refuse a document.**
`packages/schema/src/lint/rules/context.ts:55` — `scatter-density-is-sane` fires
at `severity: "warning"`. `loadScene` only refuses on **errors**, so:

```json
{ "id": "bed", "assets": ["oak"], "density": 1e9,
  "area": [[0,0],[0,100],[100,100],[100,0]] }
```

parses, lints with a warning, and `PUT /api/scenes/:id` persists it as a
legitimate authored scene. `ScatterField.density` is
`z.number().finite().positive()` — no maximum.

When that scene is opened, `packages/geometry/src/context/scatter.ts:36` computes
`maxAttempts = target * 40 + 1000`. **The bound scales with the number it is
meant to limit** — roughly 4e11 attempts — and the tab dies.

**2 — Coordinates are unbounded, and at large magnitudes the row lattice stops
advancing.** `PlanSchema` is `z.tuple([z.number(), z.number()])`. Zod rejects
NaN/Infinity but accepts `1e15`. A row-arranged scatter field around
`[1e15, 1e15]` with `rowSpacing: [0.001, 0.001]` reaches
`for (let z = b.minZ + across / 2; z <= b.maxZ; z += across)` where
`1e15 + 0.001 === 1e15` in float64 — **the loop variable never advances and the
loop never terminates**. Not slow: infinite, with no allocation and no error.

## Files you OWN

- `packages/schema/src/document.ts` — bounds on the fields that need them
- `packages/schema/src/lint/rules/context.ts` — the severity
- `packages/geometry/src/context/scatter.ts` — the sampling bounds
- The corresponding tests

## Files you must NOT touch

- `scenes/` — the three bundled scenes are all well within any sane ceiling. If a
  new bound rejects one of them, the bound is wrong; say so rather than editing
  the scene.

## What to do

1. **Decide what "too big" means, once, and write it down.** There is already a
   `maxScatterInstances` budget option — the question is whether exceeding it is
   a warning or an error. Given that the linter's stated job is that an invalid
   document is never written, and that this is the only guard on geometry volume,
   it should be an **error** above some hard multiple of the budget while staying
   a warning in the band between "more than budgeted" and "absurd". Record the
   reasoning in `decisions-scene.md`; this is a real trade-off, not an obvious call.
2. **Bound the schema where a bound is meaningful** — a maximum `density`, and a
   plan-coordinate magnitude limit. A site is a place, not the solar system;
   ±100 km is already generous and rules out the float64 failure entirely.
3. **Make the sampler's own bound absolute, not relative.** `target * 40 + 1000`
   must not be the only thing standing between a bad document and a dead tab.
4. **Make the row loop advance by construction** — iterate an integer count
   computed up front rather than accumulating a float. That removes the
   non-termination regardless of what the schema allows.
5. **Test the infinite loop specifically**, with a timeout, so it can never come
   back.

## Acceptance

- A document with an absurd density is an **error** and cannot be saved.
- The row lattice terminates for any coordinate the schema admits.
- The three bundled scenes are unaffected.
- `npm run check` exits 0.

---

## Outcome — 2026-09-12

**1 — Two thresholds, and the second one refuses the document.**
`scatter-density-is-sane` still **warns** above `maxScatterInstances` (4 000)
and now **errors** above `scatterErrorMultiple ×` that — 10×, so 40 000.
Recorded in `budgets.md`.

The reasoning, since the brief asked for it: a warning is right for a field
that is merely expensive. An author who wants 6 000 trees and will wait is
making a legitimate choice, and a linter that forbids it is wrong. A warning is
the wrong answer for `density: 1e9`, which parsed, linted with a warning, and
was persisted as a legitimate authored scene. Past a hard multiple of the
budget the number has stopped describing an intention, and "an invalid document
is never written" has to cover it. Both bands are tested, so neither can drift
into the other.

**2 — Schema bounds, which are a different guard and not a redundant one.**
`MAX_COORDINATE = 100_000` on every plan *and world* coordinate, `density`
capped at 1 000 per 100 m², `rowSpacing` floored at 10 cm.

Each catches what the other cannot, which is why both exist: `density: 1e9`
over a **1 m² polygon** is only 10 000 instances and passes the rule, while a
coordinate of 1e15 is a number no instance count can detect. The rule
understands intent; the schema holds when a field never reaches the rule.

±100 km is not a plausibility judgement — it is the float64 one. `1e15 + 0.001
=== 1e15`, so a lattice stepping by less than an ULP of its own start point
never advances and never terminates. At 1e5 a millimetre is ~1e11 ULPs, so the
failure is arithmetically unreachable rather than merely unlikely, and the test
asserts the step still resolves at exactly `MAX_COORDINATE`.

**3 — The sampler's bound is absolute.** `maxAttempts = target * 40 + 1000` was
a bound that scaled with the number it was meant to limit. It is now
`min(target * 40 + 1000, 2_000_000)`, with `target` itself clamped to 200 000.

**A fourth bound the brief did not list, and it is the one that mattered
most.** The row lattice is built from the **ratio** of coordinate span to row
spacing, and bounding both of those does not bound it: 1 000 m of field at the
minimum 0.1 m spacing is 10⁸ cells, each drawing five random numbers and
running two point-in-polygon tests, with every individual number in the
document looking entirely reasonable. `rowInstances` now throws a `RangeError`
rather than walking it.

**4 — The row loop already advances by construction.** Brief 37 replaced
`z += across` with `scatterLattice`'s integer counts while collapsing the
duplicate between the generator and the estimate. This brief adds the bound
that stops such a document existing; 37 removed the mechanism by which it hung.

**5 — Tested with timeouts**, because the failure being guarded against is not
a wrong answer but *no* answer: a 5-second `vitest` timeout on both the clamped
scatter and the refused lattice, either of which would previously have run for
longer than this session.

**Three bundled scenes unaffected** — largest coordinate in any of them is 60 m
against a 100 000 m bound, densest field 2.1 against a 1 000 cap. No bound
touches them, which is the check the brief asked for.

**One side effect on the corpus**: `decisions-scene.md` reached 212 body lines
and failed the 200-line lint. Split rather than trimmed — the placement
triangle budget and this ceiling are both about *how much geometry a document
may ask for*, which is a different question from how a scene is modelled. They
are now `wiki/budgets.md`, cross-linked both ways, and `index.md` regenerated.

`npm run check` clean, **313 tests** (was 306).
