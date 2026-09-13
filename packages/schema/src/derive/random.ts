/**
 * Deterministic RNG.
 *
 * Scatter fields declare a seed, and the same seed must produce the same forest
 * on every machine and every run — otherwise a scene is not reproducible, and a
 * render cannot be re-made from its document. `Math.random` is therefore never
 * used anywhere in this repo's generators.
 *
 * Here rather than in `geometry` because the **linter** has to reproduce a row
 * planting exactly in order to count it, and it cannot import the package that
 * draws one. Pure arithmetic, no `three` — see `derive/index.ts` for the rule.
 *
 * mulberry32: 32-bit state, fast, good enough distribution for placement —
 * once it has got going. Its **second** output is badly distributed for small
 * seeds: `mulberry32(0)` yields 0.266429, **0.000330**, 0.223272, and
 * `mulberry32(1)` yields 0.627074, **0.002736**. A scatter field consuming
 * draws as (x, z) therefore pinned its first accepted instance to within 0.03 %
 * of the bounds' southern edge — a tree standing hard against the boundary,
 * every time, for any low seed.
 *
 * So the state is stirred before the first caller sees it. Four draws is enough
 * (seed 0's fifth output is 0.467328) and costs four multiplies once per field.
 * Discarding here rather than at one call site is deliberate: the defect is the
 * generator's, and `runs.ts` seeds a pergola's canopy from the same function.
 */
const WARMUP = 4;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < WARMUP; i++) next();
  return next;
}

export const randomBetween = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min);

export const pick = <T>(rng: () => number, items: readonly T[]): T => {
  if (items.length === 0) throw new Error("pick: empty list");
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
};
