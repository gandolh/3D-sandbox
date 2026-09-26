# Task 68 — A run computes its own wall angle

## Context

From the 2026-09-20 audit. Brief 37 centralised nine duplicated computations
into `packages/schema/src/derive/`. One of them has already come back.

`packages/schema/src/derive/walls.ts` exists, in its own words, because this
formula

> lived twice — in the mesh builder and in the collider builder — which is two
> chances to negate the wrong term and no way to notice, because the mesh and the
> collider are never drawn on top of each other. A wall whose collider has
> rotated away from it is invisible until something walks through it.

`packages/geometry/src/subject/walls.ts:33` states the rule at the call site:

> The angle is `wallAngle`'s and not a local `atan2`, because `packages/physics`
> rotates the collider for this same wall and the two must not be able to drift.

`packages/geometry/src/subject/runs.ts:28` does the local `atan2` anyway:

```ts
out.push({ from, to, length, angle: Math.atan2(-(to[1] - from[1]), to[0] - from[0]) });
```

That is `wallAngle`'s body, copied. And it is consumed identically — `runs.ts:47`
does `geometry.rotateY(segment.angle)`, exactly as `walls.ts:35` does
`geometry.rotateY(wallAngle(wall))`. The file already imports from
`@solstice/schema` on line 1, so there is no dependency reason for the copy.

**Why it matters now rather than in the abstract.** `open-questions.md` records
that the scene's compass is left-handed and that the fix is "one sign, in
`directionFrom` or in the north convention". `wallAngle`'s sign convention is
therefore a live candidate for a future change. When it changes, `runs.ts`
silently keeps the old one: every pergola, fence, hedge and colonnade rotates out
of alignment with the walls it sits against, with no type error and no failing
test. That is the same "no way to notice" failure the `derive/walls.ts` comment
describes, one entity kind over.

This is cheap, and it makes the eventual compass decision cheaper — which is
exactly what brief 37 was for.

## Files you OWN

- `packages/geometry/src/subject/runs.ts`
- `packages/geometry/test/runs.test.ts`
- `apps/web/test/shared-primitives.test.ts` — the cross-package agreement tests

## Files you must NOT touch

- `packages/schema/src/derive/walls.ts` — `wallAngle` is correct. Do not change
  its sign; the compass question is a separate, deliberate decision and is not
  this brief's to make.
- The `derive/` placement rules (no `three` import, two callers in different
  packages).

## What to do

1. Replace the local `atan2` in `segments()` with `wallAngle`. Its parameter is
   `Pick<Wall, "start" | "end">`, so a run segment's `from`/`to` need adapting —
   do that at the call site rather than by loosening `wallAngle`'s type.
2. Check the rest of `runs.ts` for the same pattern: the `Math.sin`/`Math.cos`
   offsets at lines 107, 141 and 243 use `segment.angle` and must keep agreeing
   with the `(cos θ, −sin θ)` direction convention `derive/walls.ts` documents.
   The audit confirmed they currently do — keep it that way.
3. Sweep for any other local `atan2` over a plan-space pair in `packages/` and
   `apps/`, and report what you found even if it is nothing. This is the second
   occurrence; knowing whether there is a third is worth the grep.
4. **Add a cross-package agreement test**, in the style
   `apps/web/test/shared-primitives.test.ts` already uses: for the same
   two-point path, a run segment's rotation must equal `wallAngle` of the
   equivalent wall. That is the test that would have caught this, and the one
   that makes the compass change safe later.

## Acceptance

- `runs.ts` contains no local `atan2`; run geometry is unchanged (same vertices)
  before and after.
- A test asserts run-segment rotation equals `wallAngle` for the same endpoints,
  and fails if the local formula is restored — verify by mutation.
- `npm run check` exits 0.
