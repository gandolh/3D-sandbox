/**
 * Deterministic RNG.
 *
 * Scatter fields declare a seed, and the same seed must produce the same forest
 * on every machine and every run — otherwise a scene is not reproducible, and a
 * render cannot be re-made from its document. `Math.random` is therefore never
 * used anywhere in this package.
 *
 * mulberry32: 32-bit state, fast, good enough distribution for placement.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomBetween = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min);

export const pick = <T>(rng: () => number, items: readonly T[]): T => {
  if (items.length === 0) throw new Error("pick: empty list");
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
};
