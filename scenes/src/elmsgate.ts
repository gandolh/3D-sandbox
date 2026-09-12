/**
 * Elmsgate — a mid-terrace town house.
 *
 * Chosen to break the assumptions Greenhollow encodes rather than to restate
 * them. Greenhollow is a free-standing single-storey house in the middle of a
 * deep open plot; this is a **two-storey** house on a 6.5 m lot with party walls
 * hard on both boundaries, a railed forecourt on the pavement, and a small
 * walled yard behind. The plot is shallow and narrow, the setback is a metre and
 * a half rather than twenty-two, the massing is stacked rather than spread, and
 * the boundary is shared structure rather than hedge.
 *
 * The specific thing it exists to test: **`Subject.levels` is an array and no
 * scene had ever put two things in it.** Every level in the project until now
 * sat at elevation 0.
 *
 * The street is to the south (−Z) and the plot runs north. Left and right are
 * the visitor's, standing on the pavement facing the front door — so left is −X.
 */
import {
  doorOpening,
  rect,
  wallsFromFootprint,
  windowOpening,
  withOpenings,
  type SceneDocumentInput,
} from "@solstice/schema";

/* ── the lot ───────────────────────────────────────────────────── */

/** Half the lot width. A terrace is defined by this number being small. */
const HALF_WIDTH = 3.25;
/** Front of the house. The gap between it and z = 0 is the railed forecourt. */
const FRONT = 1.4;
const HOUSE_DEPTH = 9.2;
const BACK = FRONT + HOUSE_DEPTH;
/** Rear boundary wall. */
const YARD_END = 24;

const GROUND_HEIGHT = 3.0;
const FIRST_HEIGHT = 2.8;
/** Eave. The roof's `baseElevation` and the neighbours' mass height both match. */
const EAVE = GROUND_HEIGHT + FIRST_HEIGHT;

const WALL_THICKNESS = 0.34;
const HOUSE = rect(-HALF_WIDTH, FRONT, HALF_WIDTH * 2, HOUSE_DEPTH);

/**
 * The inside face of the walls.
 *
 * A floor slab on the wall centrelines puts its own edge exactly in the plane
 * of the facade, and the two z-fight as a stripe right across the elevation.
 * Ground slabs have never shown this because they sit below grade — it took a
 * storey above ground for it to appear at eye height.
 */
const INSIDE = rect(
  -HALF_WIDTH + WALL_THICKNESS / 2,
  FRONT + WALL_THICKNESS / 2,
  HALF_WIDTH * 2 - WALL_THICKNESS,
  HOUSE_DEPTH - WALL_THICKNESS,
);

/* ── walls ─────────────────────────────────────────────────────── */

/**
 * `wallsFromFootprint` walks the rectangle's edges in order, so for this
 * footprint: 01 is the street front, 02 the east party wall, 03 the yard
 * elevation, 04 the west party wall.
 *
 * The party walls carry no openings on either storey, and that is the whole
 * point of a terrace — there is a neighbour's house on the other side of them.
 */
let groundWalls = wallsFromFootprint(HOUSE, { material: "brick-stock", thickness: WALL_THICKNESS });
groundWalls = withOpenings(groundWalls, "W-01", [
  { ...doorOpening("d-front", 0.7, 1.0, 2.1), material: "door-green" },
  // The bay is a single wide opening rather than modelled joinery: the document
  // describes architecture, and a bay's mullions are not architecture at this
  // scale. Its glass reads as one plane from the street, which is the shot.
  { ...windowOpening("w-bay", 2.5, 2.8, 1.7, 0.7), material: "joinery-white" },
]);
// The yard elevation. Numbered from (x=+3.25) running in −X, because W-03 starts
// at the north-east corner.
groundWalls = withOpenings(groundWalls, "W-03", [
  { ...doorOpening("d-yard", 1.1, 1.8, 2.2), material: "joinery-white" },
  { ...windowOpening("w-kitchen", 3.7, 1.6, 1.3, 0.95), material: "joinery-white" },
]);

let firstWalls = wallsFromFootprint(HOUSE, {
  prefix: "F",
  material: "brick-stock",
  thickness: WALL_THICKNESS,
});
firstWalls = withOpenings(firstWalls, "F-01", [
  { ...windowOpening("w-s1", 0.9, 1.1, 1.65, 0.85), material: "joinery-white" },
  { ...windowOpening("w-s2", 4.2, 1.1, 1.65, 0.85), material: "joinery-white" },
]);
firstWalls = withOpenings(firstWalls, "F-03", [
  { ...windowOpening("w-b1", 1.1, 1.1, 1.5, 0.9), material: "joinery-white" },
  { ...windowOpening("w-b2", 4.1, 1.1, 1.5, 0.9), material: "joinery-white" },
]);

/**
 * The yard's boundary walls, which meet the house at its two rear corners.
 *
 * They are `Wall`s on the ground level rather than `Run`s because a brick
 * boundary wall is a solid built element with a thickness, not a profile carried
 * along a path — and because Greenhollow's street wall set the precedent.
 */
const yardWalls = [
  {
    id: "Y-W",
    start: [-HALF_WIDTH, BACK] as [number, number],
    end: [-HALF_WIDTH, YARD_END] as [number, number],
    height: 2.0,
    thickness: 0.22,
    material: "brick-yard",
  },
  {
    id: "Y-E",
    start: [HALF_WIDTH, BACK] as [number, number],
    end: [HALF_WIDTH, YARD_END] as [number, number],
    height: 2.0,
    thickness: 0.22,
    material: "brick-yard",
  },
  {
    id: "Y-N",
    start: [HALF_WIDTH, YARD_END] as [number, number],
    end: [-HALF_WIDTH, YARD_END] as [number, number],
    height: 2.0,
    thickness: 0.22,
    material: "brick-yard",
  },
];

/* ── the document ──────────────────────────────────────────────── */

const elmsgate: SceneDocumentInput = {
  schemaVersion: 1,
  id: "elmsgate",
  title: "Elmsgate",

  site: {
    latitude: 51.45,
    longitude: -2.59,
    timezone: "Europe/London",
    // The row runs roughly east–west but not exactly, which is what stops the
    // facade light being a perfectly symmetrical and slightly dead noon.
    northOffset: 12,
    terrain: { kind: "flat", size: [90, 90], material: "ground-urban" },
  },

  solar: { date: "2026-09-15", time: "11:30", hdri: "kloppenheim_02" },

  materials: {
    "brick-stock": {
      label: "Stock brick",
      source: "procedural",
      baseColor: "#9B7B5E",
      roughness: 0.92,
    },
    "brick-yard": {
      label: "Yard wall brick, weathered",
      source: "procedural",
      baseColor: "#8A705A",
      roughness: 0.95,
    },
    // A British terrace is slated, and there is no verified slate map in
    // `assets/verified.json` — so this is procedural and says so, rather than
    // borrowing the clay pantile that happens to be downloaded.
    "roof-slate": {
      label: "Welsh slate",
      source: "procedural",
      baseColor: "#5D646C",
      roughness: 0.52,
    },
    "render-stucco": {
      label: "Lime stucco",
      source: "polyhaven",
      slug: "clay_plaster",
      baseColor: "#EDE7DB",
      roughness: 0.9,
      textureScale: 2.4,
    },
    "ground-urban": {
      label: "Made ground",
      source: "ambientcg",
      slug: "Gravel023",
      baseColor: "#6E6A62",
      textureScale: 3,
    },
    "pavement-stone": {
      label: "Pavement slab",
      source: "ambientcg",
      slug: "Concrete034",
      baseColor: "#BCB8B0",
      textureScale: 2,
    },
    "paving-yard": {
      label: "Yard paving",
      source: "ambientcg",
      slug: "Concrete034",
      baseColor: "#B0ACA4",
      textureScale: 3,
    },
    "asphalt-road": {
      label: "Asphalt",
      source: "ambientcg",
      slug: "Asphalt026A",
      baseColor: "#47474A",
      textureScale: 4,
    },
    "joinery-white": {
      label: "Painted joinery",
      source: "procedural",
      baseColor: "#EAE7E0",
      roughness: 0.4,
    },
    "door-green": {
      label: "Front door, painted",
      source: "procedural",
      baseColor: "#2E4A3B",
      roughness: 0.35,
    },
    "steel-rail": {
      label: "Cast iron railing",
      source: "procedural",
      baseColor: "#32353A",
      roughness: 0.45,
      metalness: 0.6,
    },
    "neighbour-brick": {
      label: "Neighbouring terrace",
      source: "procedural",
      baseColor: "#A18468",
      roughness: 0.92,
    },
    "planting-green": {
      label: "Yard planting",
      source: "procedural",
      baseColor: "#4E6B33",
    },
  },

  subject: {
    levels: [
      {
        id: "ground",
        name: "Ground floor",
        elevation: 0,
        height: GROUND_HEIGHT,
        walls: [...groundWalls, ...yardWalls],
        slabs: [
          { id: "slab-house", polygon: HOUSE, thickness: 0.25, material: "paving-yard" },
          {
            id: "slab-forecourt",
            polygon: rect(-HALF_WIDTH, 0, HALF_WIDTH * 2, FRONT),
            thickness: 0.15,
            material: "pavement-stone",
          },
          {
            id: "slab-terrace",
            polygon: rect(-HALF_WIDTH, BACK, HALF_WIDTH * 2, 4),
            thickness: 0.15,
            material: "paving-yard",
          },
        ],
      },
      {
        // The first storey. Every level in this project before it sat at
        // elevation 0, so this is the one that proves the array was real.
        id: "first",
        name: "First floor",
        elevation: GROUND_HEIGHT,
        height: FIRST_HEIGHT,
        walls: firstWalls,
        slabs: [{ id: "slab-first", polygon: INSIDE, thickness: 0.25, material: "render-stucco" }],
      },
    ],

    roofs: [
      {
        id: "roof-house",
        kind: "gable",
        // 0.15 of eave to the street and the yard; flush at the party walls,
        // where an overhang would poke through the neighbour's roof. The
        // footprint used to be `HOUSE` exactly, which is no eave anywhere — on
        // the two elevations two of the three shots are of.
        footprint: rect(-HALF_WIDTH, FRONT - 0.15, HALF_WIDTH * 2, HOUSE_DEPTH + 0.3),
        baseElevation: EAVE,
        pitch: 38,
        // Zero, because `overhang` is the *least* the roof oversails its walls
        // on any side, and a mid-terrace is flush on two of them. The eave that
        // does exist is in the footprint above, which is where the generator
        // reads it from.
        overhang: 0,
        // Ridge along X, parallel to the street, which is what makes a row of
        // these read as one continuous roofline rather than a line of tents.
        ridgeBearing: 90,
        material: "roof-slate",
      },
    ],

    placements: [
      { id: "bench-yard", asset: "polyhaven/painted_wooden_bench", position: [1.9, 0, 16.4], rotationY: 180 },
      { id: "table-terrace", asset: "polyhaven/outdoor_table_chair_set_01", position: [-1.1, 0, 12.4], rotationY: 25 },
      { id: "planter-door", asset: "polyhaven/planter_box_01", position: [-1.9, 0, 0.75], rotationY: 0 },
      { id: "planter-bay", asset: "polyhaven/planter_box_03", position: [1.9, 0, 0.75], rotationY: 0 },
    ],

    runs: [
      // Railings either side of the front path, with the gap between them doing
      // the gate's job. Two runs rather than one with an opening, because a
      // `Run` has no openings — it is a profile along a path, and the way you
      // put a gap in one is to stop and start again.
      {
        id: "rail-west",
        kind: "fence",
        path: [
          [-HALF_WIDTH, 0.05],
          [-0.85, 0.05],
        ],
        // A fence's `width` is its thickness — it stands on one line of posts,
        // unlike a pergola where the number is the span between two rows.
        width: 0.07,
        height: 1.05,
        spacing: 1.1,
        material: "steel-rail",
      },
      {
        id: "rail-east",
        kind: "fence",
        path: [
          [0.85, 0.05],
          [HALF_WIDTH, 0.05],
        ],
        width: 0.07,
        height: 1.05,
        spacing: 1.1,
        material: "steel-rail",
      },
    ],
  },

  context: {
    masses: [
      // The row. Two each side, all at the same eave, all touching — which is
      // what makes this a terrace rather than a detached house on a thin plot.
      { id: "nb-w1", footprint: rect(-HALF_WIDTH - 6.5, FRONT, 6.5, HOUSE_DEPTH), height: EAVE, roofKind: "gable", pitch: 38, ridgeBearing: 90, material: "neighbour-brick" },
      { id: "nb-w2", footprint: rect(-HALF_WIDTH - 13, FRONT, 6.5, HOUSE_DEPTH), height: EAVE, roofKind: "gable", pitch: 38, ridgeBearing: 90, material: "neighbour-brick" },
      { id: "nb-e1", footprint: rect(HALF_WIDTH, FRONT, 6.5, HOUSE_DEPTH), height: EAVE, roofKind: "gable", pitch: 38, ridgeBearing: 90, material: "neighbour-brick" },
      { id: "nb-e2", footprint: rect(HALF_WIDTH + 6.5, FRONT, 6.5, HOUSE_DEPTH), height: EAVE, roofKind: "gable", pitch: 38, ridgeBearing: 90, material: "neighbour-brick" },
      // The backs of the row behind, which is what a terrace yard actually
      // looks out at.
      { id: "nb-rear", footprint: rect(-16, YARD_END + 6, 32, 9), height: EAVE, roofKind: "gable", pitch: 38, ridgeBearing: 90, material: "neighbour-brick" },
    ],

    roads: [
      { id: "street", path: [[-45, -5.5], [45, -5.5]], width: 7, material: "asphalt-road" },
      { id: "pavement", path: [[-45, -1.2], [45, -1.2]], width: 3.4, material: "pavement-stone" },
      { id: "pavement-far", path: [[-45, -10.7], [45, -10.7]], width: 3.4, material: "pavement-stone" },
    ],

    scatter: [
      {
        id: "yard-planting",
        assets: [
          "polyhaven/tree_small_02",
          "polyhaven/shrub_01",
          "polyhaven/shrub_02",
          "polyhaven/shrub_04",
        ],
        area: rect(-2.9, 17, 5.8, 6.4),
        density: 12,
        seed: 7,
        material: "planting-green",
        height: 3.2,
        scaleRange: [0.8, 1.2],
      },
    ],
  },

  animation: {
    duration: 10,
    loop: true,
    tracks: [
      {
        id: "sun-path",
        target: "solar.minutes",
        keyframes: [
          { at: 0, value: 7 * 60, easing: "out" },
          { at: 5, value: 13 * 60, easing: "inOut" },
          { at: 10, value: 19 * 60, easing: "in" },
        ],
      },
    ],
  },

  shots: [
    {
      id: "street-elevation",
      name: "Street elevation",
      // Straight on from across the road. A terrace only reads as a terrace when
      // the neighbours are in frame, so this is framed wide enough to catch one
      // either side rather than tight on our own facade.
      camera: { position: [0, 3.4, -12.5], target: [0, 4.6, 4.5], focalLength: 35 },
      render: { width: 1920, height: 1080, samples: 600 },
    },
    {
      id: "row-oblique",
      name: "Down the row",
      // From up the street, looking along the frontages. This is the shot that
      // shows the party-wall junction and the continuous roofline — the two
      // things that are structurally different from every scene before this one.
      camera: { position: [-17, 2.9, -8.5], target: [9, 3.6, 4.5], focalLength: 45 },
      render: { width: 1920, height: 1080, samples: 600 },
    },
    {
      id: "yard-threequarter",
      name: "Yard three-quarter",
      // From the back of the yard looking at the rear elevation, both storeys in
      // frame. The yard faces north, so this is flat light by definition and the
      // shot has to work on form rather than on sun.
      camera: { position: [2.4, 1.85, 21.5], target: [-0.6, 3.2, 11.2], focalLength: 32 },
      solar: { date: "2026-09-15", time: "12:40", hdri: "kloppenheim_02" },
      render: { width: 1920, height: 1080, samples: 600 },
    },
  ],
};

export default elmsgate;
