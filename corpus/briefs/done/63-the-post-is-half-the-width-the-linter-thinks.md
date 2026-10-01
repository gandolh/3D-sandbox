# Task 63 — The post is half the width the linter thinks

## Context

From the 2026-09-20 audit. This is the exact drift the constant was created to
prevent, recurring in the constant itself.

`packages/schema/src/derive/constants.ts:12` declares:

```ts
/**
 * The generator draws posts this size and the linter warns when a run is
 * narrower than two of them — which is only a real check while both numbers are
 * the same number. They were not: `run-is-well-formed` carried the literal
 * `2 * 0.08`, so changing the generator's post would have left the rule
 * quietly checking the old one.
 */
export const POST_HALF_WIDTH: M = 0.08;
```

The name and the comment say 0.08 is **half** a post. But the generator uses it
as the **whole** section — `packages/geometry/src/subject/runs.ts:10`:

```ts
const POST = POST_HALF_WIDTH;
```

and then builds `BoxGeometry(POST, height, POST)` — an 80 mm post, not a 160 mm
one. Meanwhile `packages/schema/src/lint/rules/runs.ts:40` keeps the doubling
that only makes sense for a half-width:

```ts
if (run.kind !== "hedge" && run.kind !== "fence" && run.width < 2 * POST_HALF_WIDTH) {
```

So the rule warns below 0.16 m while the real geometric threshold is 0.08 m.

**Verified by execution during the audit**: a colonnade with `width: 0.12`
produces posts whose bounding box is 0.080 × 3.000 × 0.080, with the two rows at
±0.06 leaving a **40 mm gap between their faces** — they plainly do not collide —
and the linter nonetheless emits

> colonnade "col" is 0.12 m wide, which is narrower than its own posts — both
> rows land in the same place

The message is false for every width in **[0.08, 0.16)**.

`packages/schema/test/derive.test.ts:52` asserts the wrong threshold
(`narrowFindings(2 * POST_HALF_WIDTH - 0.001)` expects a finding), so the test
suite currently locks the bug in.

## Files you OWN

- `packages/schema/src/derive/constants.ts`
- `packages/schema/src/lint/rules/runs.ts`
- `packages/geometry/src/subject/runs.ts` — the `POST` alias only
- `packages/schema/test/derive.test.ts`

## Files you must NOT touch

- The rest of `runs.ts`'s geometry. The post *section* is fine at 80 mm; what is
  wrong is what the number is called and what the rule does with it.
- The `derive/` placement rule. This constant belongs there; that is not in
  question.

## What to do

1. **Decide which number is the real one and make the name say it.** The
   generator's 80 mm post is the shipped geometry and the sensible value, so the
   likely fix is to rename the constant to `POST_WIDTH` and drop the `2 *` in the
   rule. Whatever you choose, the constant's name, its comment, the generator and
   the rule must all agree afterwards — that agreement is the entire point of the
   file.
2. Update the comment: it currently describes a relationship that does not hold.
3. **Fix the test, which currently asserts the bug.** The new test should pin the
   threshold to the *geometric* fact — a run narrower than one post section makes
   two rows overlap — rather than to whatever expression the rule happens to use.
4. Check the other consumers of the constant for the same confusion.

## Acceptance

- A colonnade of `width: 0.12` produces **no** `run-is-well-formed` finding, and
  one of `width: 0.05` does.
- The generated post's bounding box and the rule's threshold are derived from the
  same constant with no multiplier disagreement between them.
- The test fails if the `2 *` is reintroduced — verify by mutation.
- `npm run check` exits 0.

## Outcome — 2026-10-01

Renamed to `POST_WIDTH` (80 mm, the shipped section). The rule now warns at
`run.width < POST_WIDTH`: rows sit at ±width/2, so the faces meet at exactly one
post. The constant's comment records how the half/whole confusion arose.
`runs.ts`'s comment said "narrower than two posts" and now says one. There are
no other consumers.

**Two tests asserted the bug, not one.** Besides `derive.test.ts`,
`lint.test.ts` used `width: 0.1` (a 20 mm gap) as its "too narrow" case, and its
fence/hedge exemption test at 0.1 would have passed trivially after the fix.
All three now use absolute widths (0.12 quiet, 0.05 warns; exemptions at 0.05).

**The geometric fact is asserted against the mesh.** In
`apps/web/test/shared-primitives.test.ts`: a generated post's bounding box is
exactly `POST_WIDTH` square, and for widths 0.05, 0.079, 0.081, 0.12, 0.159 and
0.3 the rule fires **iff** the two rows' generated posts overlap. **Mutation:**
reintroducing `2 *` fails the schema test and, after a rebuild, the agreement
test at exactly 0.081, 0.12 and 0.159, which is the false-positive band.

Note for anyone mutating cross-package code: `apps/web` tests import the
packages' built `dist/`, so a source mutation is invisible to them until
`tsc --build` runs. `npm run check` builds first, so the gate is sound.
