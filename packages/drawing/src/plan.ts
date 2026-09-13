import { area, bounds, type Level, type Opening, type SceneDocument, type Wall } from "@solstice/schema";
import { CUT_HEIGHT, INK, WEIGHT } from "./style.js";
import { cutsThrough, openingPlan, project, wallCorners, wallSpan, type Sheet } from "./geometry.js";

export interface PlanOptions {
  /** Drawing scale denominator: 100 means 1:100. */
  scale?: number;
  /** Section height above the floor, m. */
  cut?: number;
  /** Sheet margin, mm. */
  margin?: number;
  /** Which level to draw. Defaults to the first. */
  levelId?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const n = (v: number): string => (Math.round(v * 100) / 100).toString();

/**
 * A floor plan of one level, as SVG.
 *
 * **A horizontal section, not a top view.** Pointing a camera down at the model
 * gives a roof; hiding the roof gives a picture of wall tops. Neither is a
 * plan. A plan cuts the building at about 1.2 m — above a sill and below a
 * head, which is why that height is the convention — and draws what the plane
 * passes through heavily, what lies below it lightly, and nothing above it.
 *
 * Pure string building, no DOM and no GPU, for the same reason `skyRadianceMap`
 * is pure arithmetic: it has to be generatable in a test on a machine with no
 * browser. That is also what lets the whole drawing be asserted rather than
 * eyeballed.
 */
export function planSvg(doc: SceneDocument, options: PlanOptions = {}): string {
  const scale = options.scale ?? 100;
  const cut = options.cut ?? CUT_HEIGHT;
  const margin = options.margin ?? 28;
  const level =
    (options.levelId === undefined
      ? doc.subject.levels[0]
      : doc.subject.levels.find((l) => l.id === options.levelId)) ?? doc.subject.levels[0];
  if (level === undefined) throw new Error("planSvg: the document has no levels");

  // Only the structure this level's plan is about. A plot's boundary wall is a
  // wall on the same level and belongs on a site plan, not on a floor plan —
  // including it would scale the sheet to the whole plot and draw the house
  // 30 mm across.
  const walls = subjectWalls(level);
  if (walls.length === 0) throw new Error("planSvg: the level has no walls");

  const extent = bounds(walls.flatMap((w) => wallCorners(w)));
  const mmPerM = 1000 / scale;
  const width = (extent.maxX - extent.minX) * mmPerM + margin * 2;
  const height = (extent.maxZ - extent.minZ) * mmPerM + margin * 2 + 22;
  const sheet: Sheet = {
    mmPerM,
    originX: extent.minX,
    originZ: extent.minZ,
    margin,
    height: height - 22,
  };
  const p = (x: number, z: number) => project(sheet, x, z);

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}mm" height="${n(height)}mm" viewBox="0 0 ${n(width)} ${n(height)}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="${n(width)}" height="${n(height)}" fill="#ffffff"/>`,
  );

  // ── rooms, under everything, so poché and symbols sit on top ──
  for (const room of level.rooms) {
    const d = room.polygon.map(([x, z], i) => `${i === 0 ? "M" : "L"}${pts(p(x, z))}`).join(" ");
    out.push(`<path d="${d} Z" fill="#f4f2ee" stroke="none"/>`);
  }

  // ── the cut: walls, poché, with the openings taken out ──
  for (const wall of walls) {
    // The cut weight, but never more than a third of the wall's own drawn
    // width. At 1:100 a 120 mm partition is 1.2 mm on paper, and a 0.7 mm
    // stroke down each side leaves 0 mm of fill between them — the partition
    // renders as a solid black bar while the 300 mm external wall renders as
    // grey with thin edges, which inverts the hierarchy the weights exist to
    // create. Capping the stroke keeps poché visible at every wall thickness.
    const drawn = wall.thickness * mmPerM;
    const stroke = Math.min(WEIGHT.cut, drawn / 3);
    for (const piece of solidSpans(wall, cut)) {
      const d = piece.map((c, i) => `${i === 0 ? "M" : "L"}${pts(p(c[0], c[1]))}`).join(" ");
      out.push(
        `<path d="${d} Z" fill="${INK.poche}" stroke="${INK.line}" stroke-width="${n(stroke)}" stroke-linejoin="miter"/>`,
      );
    }
  }

  // ── the openings, as symbols ──
  for (const wall of walls) {
    for (const opening of wall.openings) {
      out.push(...openingSymbol(wall, opening, cut, p));
    }
  }

  // ── room labels ──
  for (const room of level.rooms) {
    const b = bounds(room.polygon);
    const [cx, cz] = [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
    const [sx, sy] = p(cx, cz);
    out.push(
      `<text x="${n(sx)}" y="${n(sy - 1)}" text-anchor="middle" font-size="3.2" fill="${INK.label}">${esc(room.name.toUpperCase())}</text>`,
      `<text x="${n(sx)}" y="${n(sy + 3.6)}" text-anchor="middle" font-size="2.6" fill="${INK.faint}">${area(room.polygon).toFixed(1)} m²</text>`,
    );
  }

  out.push(...dimensionStrings(extent, p, sheet));
  out.push(...northPoint(doc, width, margin));
  out.push(...scaleBar(sheet, margin, height));
  out.push(
    `<text x="${n(margin)}" y="${n(height - 4)}" font-size="3" fill="${INK.label}">${esc(doc.title)} — ${esc(level.name)} · 1:${scale}</text>`,
    "</svg>",
  );
  return out.join("\n");
}

const pts = ([x, y]: readonly [number, number]): string => `${n(x)},${n(y)}`;

/**
 * The walls this plan is of: one building, envelope and partitions.
 *
 * A level holds every wall on the site — the house, the garage, the
 * greenhouse, and the plot's boundary. Drawing all of them would set the sheet
 * extent to the whole plot and render the house 30 mm across.
 *
 * Two steps, because one is not enough and the first version proved it.
 * Connectivity alone finds the **envelopes**: each building's walls share
 * corners and form a loop. But a partition shares corners with nothing —
 * `P-hall-w` runs from (−0.6, 20.3) to (−0.6, 27.4) and neither end touches an
 * external wall's corner — so grouping by connectivity put every partition in
 * its own group and drew the house as four blank walls with three doors in
 * them. Six of its ten doors were simply missing.
 *
 * So: pick the envelope by **enclosed area** (which also discards a boundary
 * wall, a single straight run enclosing nothing), then adopt every other wall
 * that lies inside it. A partition is a wall inside a building's footprint,
 * which is a definition rather than a heuristic.
 */
function subjectWalls(level: Level): Wall[] {
  const same = (a: readonly [number, number], b: readonly [number, number]): boolean =>
    Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  const groups: Wall[][] = [];
  for (const wall of level.walls) {
    const touching = groups.filter((g) =>
      g.some(
        (w) =>
          same(w.start, wall.start) ||
          same(w.start, wall.end) ||
          same(w.end, wall.start) ||
          same(w.end, wall.end),
      ),
    );
    if (touching.length === 0) {
      groups.push([wall]);
      continue;
    }
    const merged = touching.flat().concat(wall);
    for (const g of touching) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }

  const enclosed = (walls: Wall[]): number => {
    const b = bounds(walls.flatMap((w) => [w.start, w.end]));
    return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxZ - b.minZ);
  };

  let envelope: Wall[] = [];
  for (const group of groups) {
    // At least three walls, or it cannot enclose anything — which is what
    // discards a boundary wall however long it is.
    if (group.length < 3) continue;
    if (enclosed(group) > enclosed(envelope)) envelope = group;
  }
  if (envelope.length === 0) return level.walls;

  const box = bounds(envelope.flatMap((w) => [w.start, w.end]));
  const inside = (pt: readonly [number, number]): boolean =>
    pt[0] >= box.minX - 1e-6 &&
    pt[0] <= box.maxX + 1e-6 &&
    pt[1] >= box.minZ - 1e-6 &&
    pt[1] <= box.maxZ + 1e-6;

  return level.walls.filter(
    (w) => envelope.includes(w) || (inside(w.start) && inside(w.end)),
  );
}

/** The solid stretches of a wall: everything the section cuts that is not a hole. */
function solidSpans(wall: Wall, cut: number): [number, number][][] {
  const length = wallSpan(wall);
  const holes = wall.openings
    .filter((o) => cutsThrough(o, cut))
    .map((o) => [o.offset, o.offset + o.width] as const)
    .sort((a, b) => a[0] - b[0]);

  const spans: [number, number][] = [];
  let cursor = 0;
  for (const [from, to] of holes) {
    if (from > cursor) spans.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < length) spans.push([cursor, length]);

  return spans.map(([from, to]) => sliceCorners(wall, from, to));
}

/** A wall's plan rectangle between two distances along it. */
function sliceCorners(wall: Wall, from: number, to: number): [number, number][] {
  const plan = openingPlan(wall, { offset: from, width: to - from } as Opening);
  const [nx, nz] = plan.normal;
  const h = plan.halfThickness;
  const [ax, az] = plan.near;
  const [bx, bz] = plan.far;
  return [
    [ax + nx * h, az + nz * h],
    [bx + nx * h, bz + nz * h],
    [bx - nx * h, bz - nz * h],
    [ax - nx * h, az - nz * h],
  ];
}

type Project = (x: number, z: number) => readonly [number, number];

/**
 * A door or a window, drawn the way a plan draws one.
 *
 * **A door is a gap, a leaf and an arc.** The arc is not decoration: struck
 * from the hinge through 90°, it tells a reader the clear width, which way the
 * door opens, and what the door will hit — three facts a rectangle in a wall
 * cannot carry. It is the single most information-dense mark on a floor plan.
 *
 * **A window is the reveal with glazing across it.** The reveal lines close the
 * hole at the cut; the glazing line down the middle says it is glass rather
 * than a hole. Drawn lighter than the wall, because the wall is what the
 * section cuts and the glass is what it sees.
 */
function openingSymbol(wall: Wall, opening: Opening, cut: number, p: Project): string[] {
  const plan = openingPlan(wall, opening);
  const [ax, az] = plan.near;
  const [bx, bz] = plan.far;
  const [nx, nz] = plan.normal;
  const h = plan.halfThickness;
  const out: string[] = [];

  const edge = (side: 1 | -1): string =>
    `M${pts(p(ax + nx * h * side, az + nz * h * side))} L${pts(p(bx + nx * h * side, bz + nz * h * side))}`;

  if (opening.kind === "window") {
    // Both reveals, plus the glazing between them.
    out.push(
      `<path d="${edge(1)} ${edge(-1)}" fill="none" stroke="${INK.line}" stroke-width="${WEIGHT.seen}"/>`,
      `<path d="M${pts(p(ax, az))} L${pts(p(bx, bz))}" fill="none" stroke="${INK.glass}" stroke-width="${WEIGHT.symbol}"/>`,
    );
    return out;
  }

  // A door below the cut plane — a hatch, a low opening — is seen, not cut, so
  // it is drawn as a threshold rather than given a swing.
  if (!cutsThrough(opening, cut)) {
    out.push(
      `<path d="M${pts(p(ax, az))} L${pts(p(bx, bz))}" fill="none" stroke="${INK.line}" stroke-width="${WEIGHT.seen}" stroke-dasharray="1.4 1"/>`,
    );
    return out;
  }

  // Jambs: the reveal returns at each end of the hole.
  out.push(
    `<path d="M${pts(p(ax + nx * h, az + nz * h))} L${pts(p(ax - nx * h, az - nz * h))}` +
      ` M${pts(p(bx + nx * h, bz + nz * h))} L${pts(p(bx - nx * h, bz - nz * h))}" ` +
      `fill="none" stroke="${INK.line}" stroke-width="${WEIGHT.seen}"/>`,
  );

  // Hinged at the near jamb, opening to the +normal side. The leaf stands at
  // 90°, which is how a plan draws a door: not ajar, not shut, but showing the
  // whole quarter-circle it sweeps.
  const w = opening.width;
  const hingeX = ax;
  const hingeZ = az;
  const leafX = hingeX + nx * w;
  const leafZ = hingeZ + nz * w;
  const hinge = p(hingeX, hingeZ);
  const leaf = p(leafX, leafZ);
  const shut = p(bx, bz);
  const r = Math.hypot(leaf[0] - hinge[0], leaf[1] - hinge[1]);

  out.push(
    `<path d="M${pts(hinge)} L${pts(leaf)}" fill="none" stroke="${INK.line}" stroke-width="${WEIGHT.symbol}"/>`,
    // `sweep-flag` is chosen by the sign of the cross product, so the arc
    // always runs from the open leaf round to the shut position rather than
    // the long way about.
    `<path d="M${pts(leaf)} A${n(r)} ${n(r)} 0 0 ${sweepFlag(hinge, leaf, shut)} ${pts(shut)}" fill="none" stroke="${INK.line}" stroke-width="${WEIGHT.fine}" stroke-dasharray="none"/>`,
  );
  return out;
}

/** Which way round the swing arc goes, in sheet space. */
function sweepFlag(
  hinge: readonly [number, number],
  from: readonly [number, number],
  to: readonly [number, number],
): 0 | 1 {
  const cross =
    (from[0] - hinge[0]) * (to[1] - hinge[1]) - (from[1] - hinge[1]) * (to[0] - hinge[0]);
  return cross > 0 ? 1 : 0;
}

/**
 * Overall dimension strings, one per side.
 *
 * The numbers are what a plan is *for*. Quoted in millimetres, which is what a
 * builder works in and what the document's own units note says a length is
 * presented as.
 */
function dimensionStrings(
  extent: ReturnType<typeof bounds>,
  p: Project,
  sheet: Sheet,
): string[] {
  const out: string[] = [];
  const off = 9;
  const tick = 1.6;

  const run = (
    a: readonly [number, number],
    b: readonly [number, number],
    label: string,
    dx: number,
    dy: number,
  ): void => {
    const [ax, ay] = [a[0] + dx, a[1] + dy];
    const [bx, by] = [b[0] + dx, b[1] + dy];
    out.push(
      `<path d="M${n(ax)},${n(ay)} L${n(bx)},${n(by)}" stroke="${INK.line}" stroke-width="${WEIGHT.fine}"/>`,
      // Witness lines back to the thing being measured.
      `<path d="M${n(a[0])},${n(a[1])} L${n(ax)},${n(ay)} M${n(b[0])},${n(b[1])} L${n(bx)},${n(by)}" stroke="${INK.faint}" stroke-width="${WEIGHT.fine}"/>`,
      // Ticks at 45°, the surveyor's convention, rather than arrowheads.
      `<path d="M${n(ax - tick)},${n(ay - tick)} L${n(ax + tick)},${n(ay + tick)} M${n(bx - tick)},${n(by - tick)} L${n(bx + tick)},${n(by + tick)}" stroke="${INK.line}" stroke-width="${WEIGHT.fine}"/>`,
      `<text x="${n((ax + bx) / 2)}" y="${n((ay + by) / 2 - 1.4)}" text-anchor="middle" font-size="2.6" fill="${INK.label}">${label}</text>`,
    );
  };

  const mm = (m: number): string => `${Math.round(m * 1000)}`;
  const sw = p(extent.minX, extent.minZ);
  const se = p(extent.maxX, extent.minZ);
  const nw = p(extent.minX, extent.maxZ);

  run(nw, sw, mm(extent.maxZ - extent.minZ), -off, 0);
  run(sw, se, mm(extent.maxX - extent.minX), 0, off);
  void sheet;
  return out;
}

/** North, from the document's own `northOffset`. */
function northPoint(doc: SceneDocument, width: number, margin: number): string[] {
  // `site.northOffset` turns the plot against the compass, so the arrow turns
  // with it. A plan with a north point that ignores the site's own rotation is
  // worse than a plan with none.
  const angle = -doc.site.northOffset;
  const cx = width - margin - 6;
  const cy = margin - 4;
  // A shaft with a solid head, rather than a kite: a kite's wide tail carries
  // more ink than its tip, so the eye reads the arrow as pointing the wrong
  // way. The head is the only filled part, and it is at north.
  return [
    `<g transform="translate(${n(cx)} ${n(cy)}) rotate(${n(angle)})">`,
    `<path d="M0,6 L0,-2" stroke="${INK.line}" stroke-width="${WEIGHT.symbol}" fill="none"/>`,
    `<path d="M0,-7 L2,-1.5 L-2,-1.5 Z" fill="${INK.line}"/>`,
    `<text x="0" y="-8.4" text-anchor="middle" font-size="2.8" fill="${INK.label}">N</text>`,
    "</g>",
  ];
}

/** A scale bar, so the drawing survives being printed at the wrong size. */
function scaleBar(sheet: Sheet, margin: number, height: number): string[] {
  const metres = 5;
  const len = metres * sheet.mmPerM;
  const y = height - 12;
  const out: string[] = [
    `<path d="M${n(margin)},${n(y)} L${n(margin + len)},${n(y)}" stroke="${INK.line}" stroke-width="${WEIGHT.seen}"/>`,
  ];
  for (let i = 0; i <= metres; i++) {
    const x = margin + i * sheet.mmPerM;
    out.push(`<path d="M${n(x)},${n(y - 1.4)} L${n(x)},${n(y + 1.4)}" stroke="${INK.line}" stroke-width="${WEIGHT.fine}"/>`);
  }
  out.push(
    `<text x="${n(margin + len + 2)}" y="${n(y + 1)}" font-size="2.6" fill="${INK.label}">${metres} m</text>`,
  );
  return out;
}
