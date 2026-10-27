import { pointInPolygon, signedArea, type Wall } from "@solstice/schema";
import { clean, type Pt } from "./snap.js";

/**
 * The closed areas a level's walls make, found from their centrelines.
 *
 * The Room tool needs "the space the walls around this click enclose", and
 * the document does not store it: rooms are claims about the space, and
 * nothing derives them. So this builds a planar graph of the centrelines —
 * every wall split wherever another meets or crosses it, because a partition
 * meeting an external wall mid-length (a T) shares no end with it — and walks
 * its faces.
 *
 * Coordinates are plan `[x, z]` treated as an ordinary 2D plane. Each face is
 * walked with its inside on the left of every edge, which makes every bounded
 * face positive by the shoelace formula and each connected group's outside
 * negative.
 */

/** Points closer than this are one vertex. */
const EPS = 1e-6;

interface HalfEdge {
  from: number;
  to: number;
  /** The wall this stretch of centreline belongs to. */
  wall: Wall;
  /** Index of the reverse half-edge. */
  twin: number;
}

export interface Face {
  /** Vertex positions in walking order, the inside on the left. */
  polygon: [number, number][];
  /** The wall under each edge `polygon[i] → polygon[i + 1]`. */
  walls: Wall[];
  /** Positive for a bounded face, negative for a group's outside. */
  area: number;
  /** Which connected group of walls this face belongs to. */
  group: number;
}

const cross = (ax: number, az: number, bx: number, bz: number): number => ax * bz - az * bx;

/** Parameters along `a → b` where `c → d` touches or crosses it, in (0, 1). */
function splitsOf(a: Pt, b: Pt, c: Pt, d: Pt): number[] {
  const rx = b[0] - a[0];
  const rz = b[1] - a[1];
  const sx = d[0] - c[0];
  const sz = d[1] - c[1];
  const len = Math.hypot(rx, rz);
  const denom = cross(rx, rz, sx, sz);
  const out: number[] = [];
  const along = (p: Pt): number => ((p[0] - a[0]) * rx + (p[1] - a[1]) * rz) / (len * len);
  const offLine = (p: Pt): number => Math.abs(cross(rx, rz, p[0] - a[0], p[1] - a[1])) / len;
  if (Math.abs(denom) < 1e-12) {
    // Parallel: only an end of the other wall lying on this one splits it.
    for (const p of [c, d]) {
      const t = along(p);
      if (offLine(p) < EPS && t > EPS / len && t < 1 - EPS / len) out.push(t);
    }
    return out;
  }
  const qx = c[0] - a[0];
  const qz = c[1] - a[1];
  const t = cross(qx, qz, sx, sz) / denom;
  const u = cross(qx, qz, rx, rz) / denom;
  const sLen = Math.hypot(sx, sz);
  if (u < -EPS / sLen || u > 1 + EPS / sLen) return out;
  if (t > EPS / len && t < 1 - EPS / len) out.push(t);
  return out;
}

/** Every face of the planar graph the walls' centrelines make. */
export function planarFaces(walls: readonly Wall[]): Face[] {
  const live = walls.filter((w) => Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]) > EPS);

  // Vertices, merged within EPS. A linear scan: a level is tens of walls.
  const vertices: [number, number][] = [];
  const vertex = (p: Pt): number => {
    const found = vertices.findIndex((v) => Math.hypot(v[0] - p[0], v[1] - p[1]) < EPS);
    if (found !== -1) return found;
    vertices.push([p[0], p[1]]);
    return vertices.length - 1;
  };

  // Split each wall where any other meets it, then make an edge per stretch.
  const edges: { from: number; to: number; wall: Wall }[] = [];
  const seen = new Set<string>();
  for (const wall of live) {
    const ts = [0, 1];
    for (const other of live) {
      if (other !== wall) ts.push(...splitsOf(wall.start, wall.end, other.start, other.end));
    }
    ts.sort((p, q) => p - q);
    const at = (t: number): Pt => [
      wall.start[0] + (wall.end[0] - wall.start[0]) * t,
      wall.start[1] + (wall.end[1] - wall.start[1]) * t,
    ];
    // The ends are the wall's own numbers, so a face corner at a shared end
    // is exactly the corner the walls share.
    const ids = ts.map((t) => (t === 0 ? vertex(wall.start) : t === 1 ? vertex(wall.end) : vertex(at(t))));
    for (let i = 0; i + 1 < ids.length; i++) {
      const from = ids[i]!;
      const to = ids[i + 1]!;
      if (from === to) continue;
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      // Two walls laid along the same stretch: keep the first.
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to, wall });
    }
  }

  const half: HalfEdge[] = [];
  for (const e of edges) {
    half.push({ from: e.from, to: e.to, wall: e.wall, twin: half.length + 1 });
    half.push({ from: e.to, to: e.from, wall: e.wall, twin: half.length - 1 });
  }

  // Outgoing half-edges at each vertex, anticlockwise by angle.
  const out: number[][] = vertices.map(() => []);
  half.forEach((h, i) => out[h.from]!.push(i));
  const angle = (i: number): number => {
    const h = half[i]!;
    const [fx, fz] = vertices[h.from]!;
    const [tx, tz] = vertices[h.to]!;
    return Math.atan2(tz - fz, tx - fx);
  };
  for (const list of out) list.sort((p, q) => angle(p) - angle(q));

  // Connected groups, for telling which outside belongs to which building.
  const parent = vertices.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  for (const e of edges) parent[find(e.from)] = find(e.to);

  // Walk: after arriving at v along u → v, leave by the edge just clockwise
  // of v → u. That keeps the face on the left.
  const next = (i: number): number => {
    const h = half[i]!;
    const list = out[h.to]!;
    const k = list.indexOf(h.twin);
    return list[(k - 1 + list.length) % list.length]!;
  };

  const faces: Face[] = [];
  const used = new Set<number>();
  for (let start = 0; start < half.length; start++) {
    if (used.has(start)) continue;
    const cycle: number[] = [];
    let i = start;
    do {
      used.add(i);
      cycle.push(i);
      i = next(i);
    } while (i !== start && cycle.length <= half.length);

    const trimmed = withoutSpikes(cycle, half);
    if (trimmed.length < 3) continue;
    const polygon = trimmed.map((k) => vertices[half[k]!.from]!);
    faces.push({
      polygon,
      walls: trimmed.map((k) => half[k]!.wall),
      area: signedArea(polygon),
      group: find(half[start]!.from),
    });
  }
  return faces;
}

/**
 * Drop out-and-back stretches: a wall with a free end walked up one side and
 * down the other. It is inside the face, not part of its outline.
 */
function withoutSpikes(cycle: number[], half: HalfEdge[]): number[] {
  const list = [...cycle];
  let changed = true;
  while (changed && list.length >= 2) {
    changed = false;
    for (let k = 0; k < list.length; k++) {
      const a = list[k]!;
      const b = list[(k + 1) % list.length]!;
      if (half[a]!.twin === b) {
        if (k + 1 < list.length) {
          list.splice(k, 2);
        } else {
          // The pair wraps round the end of the list.
          list.splice(k, 1);
          list.splice(0, 1);
        }
        changed = true;
        break;
      }
    }
  }
  return list;
}

/** The smallest closed area around `point`, or null when the point is in none. */
export function faceAt(walls: readonly Wall[], point: Pt): Face | null {
  let best: Face | null = null;
  for (const face of planarFaces(walls)) {
    if (face.area <= EPS) continue;
    if (!pointInPolygon([point[0], point[1]], face.polygon)) continue;
    if (best === null || face.area < best.area) best = face;
  }
  return best;
}

/**
 * Move every edge of a face to its left by its own wall's half thickness, and
 * join the moved edges where they meet.
 *
 * For a bounded face that is inward, to the faces of the walls: the clear
 * internal outline a room's polygon is. For a group's outside it is outward,
 * to the walls' outer faces: the outline a floor slab is laid under.
 */
export function offsetFace(face: Face): [number, number][] {
  const n = face.polygon.length;
  const lines = face.polygon.map((p, i) => {
    const q = face.polygon[(i + 1) % n]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const d: [number, number] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    const h = face.walls[i]!.thickness / 2;
    // Left of the direction of travel, in the plane's own frame.
    const left: [number, number] = [-d[1], d[0]];
    return { p: [p[0] + left[0] * h, p[1] + left[1] * h] as [number, number], d, h, left };
  });

  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n]!;
    const b = lines[i]!;
    const denom = cross(a.d[0], a.d[1], b.d[0], b.d[1]);
    if (Math.abs(denom) < 1e-9) {
      // Straight on. The same thickness carries straight through; a
      // different one steps across at the joint.
      if (Math.abs(a.h - b.h) < EPS) continue;
      const v = face.polygon[i]!;
      out.push(
        [v[0] + a.left[0] * a.h, v[1] + a.left[1] * a.h],
        [v[0] + b.left[0] * b.h, v[1] + b.left[1] * b.h],
      );
      continue;
    }
    const t = cross(b.p[0] - a.p[0], b.p[1] - a.p[1], b.d[0], b.d[1]) / denom;
    out.push([a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t]);
  }
  return out.map(([x, z]) => [clean(x), clean(z)]);
}

/** A room's polygon: the clear internal outline of the closed area around `point`. */
export function roomOutline(walls: readonly Wall[], point: Pt): [number, number][] | null {
  const face = faceAt(walls, point);
  return face === null ? null : offsetFace(face);
}

/**
 * A floor slab's polygon: the outer outline of the building whose walls close
 * around `point` — its outside, moved out to the walls' outer faces.
 */
export function floorOutline(walls: readonly Wall[], point: Pt): [number, number][] | null {
  const faces = planarFaces(walls);
  const inside = faces
    .filter((f) => f.area > EPS && pointInPolygon([point[0], point[1]], f.polygon))
    .sort((a, b) => a.area - b.area)[0];
  if (inside === undefined) return null;
  // The group's outside is its one negative face; with several (a group
  // closing round a courtyard), the largest is the outer one.
  const outside = faces
    .filter((f) => f.group === inside.group && f.area < -EPS)
    .sort((a, b) => a.area - b.area)[0];
  if (outside === undefined) return null;
  return offsetFace(outside).reverse();
}
