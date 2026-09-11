import * as THREE from "three";
import type { Plan, Run } from "@solstice/schema";
import { ensureStandardAttributes } from "../attributes.js";

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
 * Posts down both sides of the path, at `spacing`.
 *
 * The last post is forced onto the segment's end rather than left wherever the
 * spacing happened to stop. A pergola whose final bay is 0.3 m deep looks like
 * a bug, because it is one.
 */
function posts(run: Run, height: number): THREE.BufferGeometry[] {
  const half = run.width / 2;
  const out: THREE.BufferGeometry[] = [];
  for (const segment of segments(run.path)) {
    const bays = Math.max(1, Math.round(segment.length / run.spacing));
    const step = segment.length / bays;
    for (let i = 0; i <= bays; i++) {
      for (const side of [-half, half]) {
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

/** A head beam down each side; a pergola adds rafters across them. */
function beams(run: Run, height: number, rafters: boolean): THREE.BufferGeometry[] {
  const half = run.width / 2;
  const out: THREE.BufferGeometry[] = [];
  for (const segment of segments(run.path)) {
    for (const side of [-half, half]) {
      const beam = new THREE.BoxGeometry(segment.length, BEAM, BEAM);
      beam.translate(0, height - BEAM / 2, 0);
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

/** The climber trained over a pergola: a slab of foliage sitting on the beams. */
function canopy(run: Run, height: number): THREE.BufferGeometry[] {
  return segments(run.path).map((segment) => {
    const geometry = new THREE.BoxGeometry(segment.length, CANOPY, run.width + 0.4);
    geometry.translate(0, height + CANOPY / 2, 0);
    geometry.rotateY(segment.angle);
    geometry.translate(
      (segment.from[0] + segment.to[0]) / 2,
      0,
      (segment.from[1] + segment.to[1]) / 2,
    );
    return geometry;
  });
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
