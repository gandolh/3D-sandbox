import type { Level, Wall } from "@solstice/schema";
import type * as THREE from "three";

/**
 * Wall geometry, kept between generations.
 *
 * **Why only walls.** The generator rebuilds the whole document on every
 * revision, which is the design and stays the design — geometry is derived, and
 * regenerating everything is what makes it impossible for the scene graph to
 * disagree with the document. But after briefs 51 and 52 the remaining cost is
 * concentrated: of Greenhollow's 28 ms build, **23 ms is wall CSG** — 82 % —
 * across the 11 walls that carry openings. Runs are 1.5 ms and roofs 0.3 ms.
 * Caching those too would add risk for a rounding error.
 *
 * Measured: rebuilding 23 walls is 20.0 ms; serving 22 from here and rebuilding
 * the one that moved is **3.75 ms**.
 *
 * **The invariant is that this cannot change what gets drawn.** A cache that
 * can serve a stale mesh is strictly worse than the cost it saves — this
 * project has already paid for one cache keyed on too little (brief 24). Two
 * things enforce it:
 *
 * 1. **The key is the whole wall.** Not a hand-listed set of fields, which is
 *    exactly what went stale in brief 24 — `JSON.stringify` over the entire
 *    `Wall` plus the two `Level` fields `buildWall` reads. Add a field to
 *    `Wall` tomorrow and it participates in the key without anyone
 *    remembering. The key costs 0.02 ms for 23 walls against 20 ms of CSG.
 * 2. **Callers get a clone**, never the cached geometry. The scene disposes
 *    what it owns; the cache keeps its own copy. Handing out the original
 *    would let one generation's teardown blank the next one's walls.
 */
export class GeometryCache {
  /**
   * Bounded, because a long editing session visits a new key on every nudge of
   * every wall and an unbounded map would hold every intermediate state's
   * geometry for the life of the tab. Insertion-ordered eviction: a `Map`
   * iterates oldest-first, which is the only ordering guarantee needed here.
   */
  private readonly limit: number;
  private readonly walls = new Map<string, THREE.BufferGeometry>();

  hits = 0;
  misses = 0;

  constructor(limit = 256) {
    this.limit = limit;
  }

  /**
   * The geometry for this wall, built once per distinct shape.
   *
   * `build` is passed in rather than imported so this file stays free of the
   * CSG evaluator and can be unit-tested without one.
   */
  wall(wall: Wall, level: Level, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
    const key = JSON.stringify([wall, level.height, level.elevation]);
    const hit = this.walls.get(key);
    if (hit !== undefined) {
      this.hits++;
      return hit.clone();
    }

    this.misses++;
    const geometry = build();
    this.walls.set(key, geometry);

    while (this.walls.size > this.limit) {
      const oldest = this.walls.keys().next();
      if (oldest.done === true) break;
      this.walls.get(oldest.value)?.dispose();
      this.walls.delete(oldest.value);
    }

    return geometry.clone();
  }

  get size(): number {
    return this.walls.size;
  }

  dispose(): void {
    for (const geometry of this.walls.values()) geometry.dispose();
    this.walls.clear();
  }
}
