---
summary: What a scene document is allowed to ask for — the placement triangle budget, the scatter instance ceiling, and the schema bounds that hold when a lint rule cannot.
updated: 2026-09-12
---

# Budgets and ceilings

Two locked decisions about the **volume of geometry a document may request**.
They share a premise: geometry here is derived, so nothing in the document is
self-limiting, and a single number can ask for more than any machine has. Split
out of [decisions-scene.md](decisions-scene.md), which is about how a scene is
*modelled*; this page is about how much of it there may be.

## A subject placement carries a triangle budget (2026-09-11)

One hero tree beside the house is 17.4 M triangles in the BVH — heavy but
survivable on a GPU, and legitimate under the tier split. "Legitimate" needs a
number, though, or the tier boundary is a vibe.

Polycount goes into the manifest (Poly Haven reports it; it is not something we
have to measure), and a lint rule warns when a level's subject placements exceed
the budget. The budget is a warning, not an error: it is a judgement about this
machine, and a machine with more memory is allowed a different one.

## A document has a geometry ceiling, and past it the linter refuses
_2026-09-12_ — `scatter-density-is-sane` warns above `maxScatterInstances`
(4 000) and **errors** above `scatterErrorMultiple × ` that (10×, so 40 000).
Coordinates are bounded to ±100 km, `density` to 1 000 per 100 m², `rowSpacing`
to no finer than 10 cm.

*Why two thresholds rather than one.* A warning is right for a field that is
merely expensive — an author who wants 6 000 trees and will wait is making a
legitimate choice, and a linter that forbids it is wrong. A warning is the
wrong answer for `density: 1e9`, which parsed, linted with a *warning*, and was
persisted by `PUT /api/scenes/:id` as a legitimate authored scene, because
`loadScene` only refuses on errors. Opening it computed `target * 40 + 1000`
attempts — a bound that scales with the number it is meant to limit — at about
4 × 10¹¹, and the tab died. Past a hard multiple of the budget the number has
stopped describing an intention, and the linter's stated job, that an invalid
document is never written, has to cover it.

*Why the schema bounds as well, when the rule already errors.* These documents
are AI-authored. A misplaced exponent is not an exotic adversarial input here;
it is the expected failure. The rule is the guard that understands *intent* —
it counts instances against a budget — and the schema bounds are the ones that
hold when a field never reaches the rule. Each catches what the other cannot:
`density: 1e9` over a 1 m² polygon is only 10 000 instances and passes the
rule; a coordinate of 1e15 is a number no count can detect.

*Why ±100 km specifically.* A site is a place, not the solar system. The bound
is not about plausibility but about float64: `1e15 + 0.001 === 1e15`, so a
lattice stepping by less than an ULP of its own start point never advances and
never terminates — not slowly, never, with no allocation and no error to catch.
At 1e5 a millimetre is ~1e11 ULPs, so the failure is arithmetically unreachable
rather than merely unlikely.

- *Rejected*: bounding `density` alone. The lattice is built from the *ratio* of
  coordinate span to row spacing, and neither of those being bounded bounds it —
  1 000 m at 0.1 m is 10⁸ cells with every individual number looking reasonable.
- *Consequence*: `scatterInstances` also clamps absolutely (200 000 instances,
  2 000 000 attempts) and throws on a lattice past the ceiling. Reaching those
  means something got past the linter, which is exactly when a generator should
  still not be able to hang the machine it runs on.
