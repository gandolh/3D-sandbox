import * as THREE from "three";
import type { Plan, Run } from "@solstice/schema";
import { ensureStandardAttributes } from "../attributes.js";
import { mulberry32, randomBetween } from "../random.js";
import { mergeSimple } from "../context/scatter.js";

/** Post section, in metres. Slim enough to read as metalwork at render scale. */
const POST = 0.08;
/** Beam section for a pergola's rafters. */
const BEAM = 0.07;
/** How thick a trained climber reads as, sitting on top of the beams. */
const CANOPY = 0.22;

interface Segment {
  from: Plan;
  to: Plan;
  length: number;
  angle: number;
}

function segments(path: readonly Plan[]): Segment[] {
  const out: Segment[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const to = path[i]!;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (length < 1e-6) continue;
    out.push({ from, to, length, angle: Math.atan2(-(to[1] - from[1]), to[0] - from[0]) });
  }
  return out;
}

/** Total path length — used by the scene tree and by the post-count estimate. */
export function runLength(run: Run): number {
  return segments(run.path).reduce((sum, s) => sum + s.length, 0);
}

/** A box laid along a segment at distance `t`, in world space. */
function boxAt(
  segment: Segment,
  t: number,
  size: [number, number, number],
  baseY: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(...size);
  geometry.translate(0, size[1] / 2 + baseY, 0);
  geometry.rotateY(segment.angle);
  const u = t / segment.length;
  geometry.translate(
    segment.from[0] + (segment.to[0] - segment.from[0]) * u,
    0,
    segment.from[1] + (segment.to[1] - segment.from[1]) * u,
  );
  return geometry;
}

/**
 * A hedge: one continuous solid carried along the path.
 *
 * Deliberately a box rather than instanced foliage. A hedge is read as a mass
 * and an edge, not as individual plants — the scatter tier is where individual
 * plants belong, and a 60 m hedge of 200k-triangle shrubs would cost more than
 * the house.
 */
function hedgeParts(run: Run): THREE.BufferGeometry[] {
  return segments(run.path).map((segment) => {
    const geometry = new THREE.BoxGeometry(segment.length, run.height, run.width);
    geometry.translate(0, run.height / 2, 0);
    geometry.rotateY(segment.angle);
    geometry.translate(
      (segment.from[0] + segment.to[0]) / 2,
      0,
      (segment.from[1] + segment.to[1]) / 2,
    );
    return geometry;
  });
}

/**
 * Which side-offsets a run's uprights stand on.
 *
 * A pergola and a colonnade are things you walk *through*: two rows of posts
 * with a span between them, and `width` is that span. **A fence is not.** It is
 * one line of posts, and its `width` is the thickness of the thing, not a gap —
 * so building it as two rows put a duplicate row 70 mm away, which is both twice
 * the geometry and visibly wrong from anywhere close.
 *
 * Found by authoring Elmsgate's front railings, which is the first fence in any
 * scene: Greenhollow's runs are a pergola, a colonnade and two hedges.
 */
function sidesFor(run: Run): number[] {
  return run.kind === "fence" ? [0] : [-run.width / 2, run.width / 2];
}

/**
 * Posts along the path, at `spacing`.
 *
 * The last post is forced onto the segment's end rather than left wherever the
 * spacing happened to stop. A pergola whose final bay is 0.3 m deep looks like
 * a bug, because it is one.
 */
function posts(run: Run, height: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const segment of segments(run.path)) {
    const bays = Math.max(1, Math.round(segment.length / run.spacing));
    const step = segment.length / bays;
    for (let i = 0; i <= bays; i++) {
      for (const side of sidesFor(run)) {
        const post = boxAt(segment, i * step, [POST, height, POST], 0);
        // Offset perpendicular to the run: rotate the side vector into place.
        post.translate(
          Math.sin(segment.angle) * side * -1,
          0,
          Math.cos(segment.angle) * side * -1,
        );
        out.push(post);
      }
    }
  }
  return out;
}

/**
 * Head beams; a pergola adds rafters across them.
 *
 * A fence gets two **rails** on its single line instead of one beam per side —
 * a top rail and a mid rail, which is what makes a railing read as a railing
 * rather than as a row of unconnected stakes.
 */
function beams(run: Run, height: number, rafters: boolean): THREE.BufferGeometry[] {
  const half = run.width / 2;
  const out: THREE.BufferGeometry[] = [];
  const rails: readonly { side: number; at: number }[] =
    run.kind === "fence"
      ? [
          { side: 0, at: height - BEAM / 2 },
          { side: 0, at: height * 0.45 },
        ]
      : [
          { side: -half, at: height - BEAM / 2 },
          { side: half, at: height - BEAM / 2 },
        ];
  for (const segment of segments(run.path)) {
    for (const { side, at } of rails) {
      const beam = new THREE.BoxGeometry(segment.length, BEAM, BEAM);
      beam.translate(0, at, 0);
      beam.rotateY(segment.angle);
      beam.translate(
        (segment.from[0] + segment.to[0]) / 2 + Math.sin(segment.angle) * side * -1,
        0,
        (segment.from[1] + segment.to[1]) / 2 + Math.cos(segment.angle) * side * -1,
      );
      out.push(beam);
    }
    if (!rafters) continue;

    // Cross rafters at half the post pitch — the thing that actually reads as a
    // pergola rather than as two parallel rails.
    const bays = Math.max(1, Math.round(segment.length / (run.spacing / 2)));
    const step = segment.length / bays;
    for (let i = 0; i <= bays; i++) {
      const rafter = boxAt(segment, i * step, [BEAM, BEAM, run.width + 0.3], height - BEAM);
      out.push(rafter);
    }
  }
  return out;
}

/**
 * The climber trained over a pergola: a canopy of leaf clusters, not a slab.
 *
 * A solid box was the first attempt and it reads as a black soffit — which is
 * exactly right for a solid box and exactly wrong for a vine. What makes a vine
 * a vine, from underneath, is that light comes *through* it in patches.
 *
 * So the canopy is many small quads with gaps between them. Geometry rather than
 * an alpha-cut texture, because no CC0 leaf texture with an alpha channel is in
 * the asset set — and gaps in geometry are honest in a way a missing texture is
 * not: the path tracer gets real light through real holes, with no material
 * trickery to go wrong.
 */
const LEAF = 0.34;
/** Clusters per square metre of canopy. Enough to read as dense, sparse enough to see sky. */
const LEAF_DENSITY = 34;

function canopy(run: Run, height: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  // Seeded from the run's own id, so a canopy is stable across reloads and two
  // pergolas in one scene do not get identical foliage.
  let seed = 0;
  for (const ch of run.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = mulberry32(seed);

  for (const segment of segments(run.path)) {
    const count = Math.max(1, Math.round(segment.length * run.width * LEAF_DENSITY));
    for (let i = 0; i < count; i++) {
      const along = rng() * segment.length;
      const across = randomBetween(rng, -run.width / 2 - 0.2, run.width / 2 + 0.2);
      const size = LEAF * randomBetween(rng, 0.7, 1.5);

      // A cluster is two quads crossed, not one.
      //
      // A single flat quad presents as a thin sliver at a grazing angle, so from
      // directly underneath — which is where the approach shot puts the viewer —
      // the canopy thinned out into scattered specks. Crossing them gives a
      // cluster presence from any direction, for two triangles more. The same
      // reason the tree impostors are crossed quads rather than billboards.
      const tilt = -Math.PI / 2 + randomBetween(rng, -0.7, 0.7);
      const spin = rng() * Math.PI * 2;
      const a = new THREE.PlaneGeometry(size, size);
      a.rotateX(tilt);
      a.rotateY(spin);
      const b = new THREE.PlaneGeometry(size, size);
      b.rotateX(tilt);
      b.rotateY(spin + Math.PI / 2);
      const leaf = mergeSimple([a, b]);
      a.dispose();
      b.dispose();

      const u = along / segment.length;
      leaf.translate(
        segment.from[0] +
          (segment.to[0] - segment.from[0]) * u +
          Math.sin(segment.angle) * across * -1,
        height + randomBetween(rng, 0.02, 0.26),
        segment.from[1] +
          (segment.to[1] - segment.from[1]) * u +
          Math.cos(segment.angle) * across * -1,
      );
      out.push(leaf);
    }
  }
  return out;
}

export interface RunGeometry {
  /** The run's own material. */
  structure: THREE.BufferGeometry[];
  /** The climber over a pergola, if it has one. Its own material. */
  climber: THREE.BufferGeometry[];
}

/**
 * Geometry for a hedge, fence or pergola.
 *
 * Returned in two piles rather than one merged solid because a pergola's
 * metalwork and the vine over it are different materials, and merging them would
 * mean the render could not tell steel from leaves.
 */
export function buildRun(run: Run): RunGeometry {
  if (run.kind === "hedge") {
    return { structure: hedgeParts(run).map(ensureStandardAttributes), climber: [] };
  }

  const height = run.height;
  const structure = [...posts(run, height), ...beams(run, height, run.kind === "pergola")];
  const climber =
    run.kind === "pergola" && run.climber !== undefined ? canopy(run, height) : [];

  return {
    structure: structure.map(ensureStandardAttributes),
    climber: climber.map(ensureStandardAttributes),
  };
}
