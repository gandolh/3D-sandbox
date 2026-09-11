/**
 * Greenhollow — a smallholding on the edge of a village.
 *
 * A gabled house set well back from the road, its porch on the west side and a
 * vine-covered pergola running from the front door down to the gate. A garage to
 * the east off the same alley, roses either side of it. Behind the house: a
 * kitchen garden, a greenhouse, a pond, and an orchard planted in rows at the
 * far end. Hedges down both flanks, a concrete wall and a metal gate at the road.
 *
 * The plot runs north from the road: +Z is north, the road is to the south, and
 * the front boundary is z = 0. Left and right are the visitor's, entering the
 * gate and facing the house — so left is −X.
 *
 * This is the first scene authored as a *place* rather than as a schema
 * exercise, and it is what turned up `Run`, row-planted scatter, and the fact
 * that `roof-covers-walls` assumed one building per plot.
 */
import {
  doorOpening,
  rect,
  wallsFromFootprint,
  windowOpening,
  withOpenings,
  type SceneDocumentInput,
  type WallSpec,
} from "@solstice/schema";

/* ── the plot ──────────────────────────────────────────────────── */

const PLOT_HALF_WIDTH = 16;
const PLOT_DEPTH = 62;

/** Eave heights. Each roof's `baseElevation` must match one of these. */
const HOUSE_EAVE = 3.0;
const GARAGE_EAVE = 2.8;
const GREENHOUSE_EAVE = 2.6;
const PORCH_EAVE = 2.7;

const HOUSE = rect(-5.5, 22, 11, 10);
const PORCH = rect(-9.5, 23, 4, 8);
const GARAGE = rect(7, 20, 7, 7);
const GREENHOUSE = rect(-10, 36, 5, 6);

/* ── walls ─────────────────────────────────────────────────────── */

// The house: walls run anticlockwise from the south-west corner, so W-01 is the
// street-facing front — the wall the pergola arrives at.
let houseWalls = wallsFromFootprint(HOUSE, { material: "plaster-lime", thickness: 0.3 });
houseWalls = withOpenings(houseWalls, "W-01", [
  windowOpening("w-f1", 1.4, 1.5, 1.3, 0.95),
  doorOpening("d-front", 4.9, 1.2, 2.2),
  windowOpening("w-f2", 8.0, 1.5, 1.3, 0.95),
]);
houseWalls = withOpenings(houseWalls, "W-02", [
  windowOpening("w-e1", 2.2, 1.3, 1.3, 0.95),
  windowOpening("w-e2", 6.4, 1.3, 1.3, 0.95),
]);
// The garden side, facing the pond and the orchard: the big windows go here.
houseWalls = withOpenings(houseWalls, "W-03", [
  windowOpening("w-g1", 1.6, 2.2, 1.7, 0.75),
  doorOpening("d-garden", 5.0, 1.2, 2.2),
  windowOpening("w-g2", 8.2, 2.2, 1.7, 0.75),
]);
// The west wall opens onto the porch.
houseWalls = withOpenings(houseWalls, "W-04", [
  doorOpening("d-porch", 3.4, 1.0, 2.1),
  windowOpening("w-p1", 6.2, 1.2, 1.2, 0.95),
]);

let garageWalls = wallsFromFootprint(GARAGE, {
  prefix: "G",
  material: "plaster-lime",
  thickness: 0.25,
  height: GARAGE_EAVE,
});
// The garage door faces the alley, which arrives from the south-west.
garageWalls = withOpenings(garageWalls, "G-01", [doorOpening("d-garage", 1.4, 4.2, 2.4)]);

let greenhouseWalls = wallsFromFootprint(GREENHOUSE, {
  prefix: "H",
  material: "glass-house",
  thickness: 0.08,
  height: GREENHOUSE_EAVE,
});
greenhouseWalls = withOpenings(greenhouseWalls, "H-01", [doorOpening("d-glass", 1.9, 1.1, 2.0)]);

/**
 * The road boundary: one wall with the gate cut out of it.
 *
 * A gate *is* an aperture in a wall, so it is an `Opening` and not a thing of
 * its own. The opening is 4 m wide and centred, which on a 32 m wall puts its
 * near edge at 14 m.
 */
const boundaryWall: WallSpec = {
  id: "B-01",
  start: [-PLOT_HALF_WIDTH, 0],
  end: [PLOT_HALF_WIDTH, 0],
  material: "concrete-wall",
  thickness: 0.3,
  height: 1.8,
  openings: [{ id: "gate", kind: "door", offset: 14, width: 4, height: 1.8, sill: 0, material: "steel-dark" }],
};

/* ── the document ──────────────────────────────────────────────── */

const greenhollow: SceneDocumentInput = {
  schemaVersion: 1,
  id: "greenhollow",
  title: "Greenhollow",

  site: {
    latitude: 45.7489,
    longitude: 21.2087,
    timezone: "Europe/Bucharest",
    // The plot's +Z — the deep end, where the orchard is — points north-east, so
    // the front of the house faces south-west and takes the afternoon sun while
    // the garden side takes the morning. Axis-aligned to true north would put
    // the whole garden elevation in permanent shade, which is a fine thing for a
    // document to permit and a poor thing for a scene about renders to do.
    northOffset: 40,
    terrain: { kind: "flat", size: [280, 280], material: "grass-lawn" },
  },

  // Mid-September, late afternoon: the sun is round on the front of the house
  // and rakes down the length of the pergola toward the gate.
  solar: { date: "2026-09-12", time: "17:20", hdri: "kloppenheim_06" },

  materials: {
    "plaster-lime": {
      label: "Lime Plaster",
      source: "polyhaven",
      slug: "plaster_brick_pattern",
      baseColor: "#E9E1D3",
      roughness: 0.84,
    },
    "roof-clay-tile": {
      label: "Clay Roof Tile",
      source: "polyhaven",
      slug: "roof_tiles_14",
      baseColor: "#9C5540",
      roughness: 0.66,
    },
    "roof-zinc": {
      label: "Standing-seam Zinc",
      source: "procedural",
      baseColor: "#6E7378",
      roughness: 0.42,
      metalness: 0.8,
    },
    "slab-concrete": {
      label: "Board-formed Concrete",
      source: "ambientcg",
      slug: "Concrete034",
      baseColor: "#B9B5AD",
      roughness: 0.9,
    },
    "concrete-wall": {
      label: "Cast Concrete",
      source: "ambientcg",
      slug: "Concrete034",
      baseColor: "#C2BDB3",
      roughness: 0.88,
    },
    "steel-dark": {
      label: "Dark Steel",
      source: "procedural",
      baseColor: "#3A3D42",
      roughness: 0.35,
      metalness: 0.95,
    },
    "glass-house": {
      label: "Greenhouse Glazing",
      source: "procedural",
      baseColor: "#CFE0DA",
      roughness: 0.08,
      metalness: 0.1,
    },
    "grass-lawn": {
      label: "Mown Lawn",
      source: "polyhaven",
      slug: "coast_sand_rocks_02",
      baseColor: "#5C7B43",
      roughness: 1,
    },
    "gravel-alley": {
      label: "Gravel",
      source: "ambientcg",
      slug: "Gravel023",
      baseColor: "#A79D8D",
      roughness: 0.96,
    },
    "asphalt-road": {
      label: "Worn Asphalt",
      source: "ambientcg",
      slug: "Asphalt026A",
      baseColor: "#47474A",
      roughness: 0.95,
    },
    "hedge-green": {
      label: "Clipped Hedge",
      source: "procedural",
      baseColor: "#3F5A32",
      roughness: 1,
    },
    "rose-green": {
      label: "Rose Bush",
      source: "procedural",
      baseColor: "#5A7A3E",
      roughness: 1,
    },
    "orchard-green": {
      label: "Fruit Tree",
      source: "procedural",
      baseColor: "#4A6B38",
      roughness: 1,
    },
    "vegetable-green": {
      label: "Vegetable Bed",
      source: "procedural",
      baseColor: "#6B7F3C",
      roughness: 1,
    },
    "vine-green": {
      label: "Grapevine",
      source: "procedural",
      baseColor: "#4E6B33",
      roughness: 0.95,
    },
    "water-pond": {
      label: "Still Water",
      source: "procedural",
      baseColor: "#2C4A52",
      roughness: 0.04,
      metalness: 0.1,
    },
    "render-neighbour": {
      label: "Neutral Render",
      source: "procedural",
      baseColor: "#C9C3B6",
      roughness: 0.85,
    },
  },

  subject: {
    levels: [
      {
        id: "ground",
        name: "Ground",
        elevation: 0,
        height: HOUSE_EAVE,
        walls: [...houseWalls, ...garageWalls, ...greenhouseWalls, boundaryWall],
        slabs: [
          { id: "slab-house", polygon: HOUSE, thickness: 0.3, material: "slab-concrete" },
          { id: "slab-porch", polygon: PORCH, thickness: 0.2, material: "slab-concrete" },
          { id: "slab-garage", polygon: GARAGE, thickness: 0.25, material: "slab-concrete" },
          { id: "slab-greenhouse", polygon: GREENHOUSE, thickness: 0.15, material: "slab-concrete" },
          // The pond is a slab of water, set just below the lawn.
          {
            id: "pond",
            polygon: [
              [4.2, 35.4],
              [7.4, 34.8],
              [9.8, 36.6],
              [10.1, 39.4],
              [8.0, 41.2],
              [5.1, 40.6],
              [3.8, 38.2],
            ],
            thickness: 0.12,
            material: "water-pond",
          },
        ],
      },
    ],

    roofs: [
      {
        id: "roof-house",
        kind: "gable",
        // Ridge runs east–west, so the gable ends face the road and the garden
        // and the long eaves shelter the porch side.
        footprint: rect(-6.0, 21.5, 12, 11),
        baseElevation: HOUSE_EAVE,
        pitch: 38,
        overhang: 0.5,
        ridgeBearing: 90,
        material: "roof-clay-tile",
      },
      {
        id: "roof-porch",
        kind: "flat",
        footprint: rect(-9.9, 22.6, 4.6, 8.8),
        baseElevation: PORCH_EAVE,
        pitch: 0,
        overhang: 0.3,
        material: "roof-zinc",
      },
      {
        id: "roof-garage",
        kind: "gable",
        footprint: rect(6.6, 19.6, 7.8, 7.8),
        baseElevation: GARAGE_EAVE,
        pitch: 30,
        overhang: 0.4,
        ridgeBearing: 90,
        material: "roof-clay-tile",
      },
      {
        id: "roof-greenhouse",
        kind: "gable",
        footprint: rect(-10.3, 35.7, 5.6, 6.6),
        baseElevation: GREENHOUSE_EAVE,
        pitch: 26,
        overhang: 0.15,
        ridgeBearing: 0,
        material: "glass-house",
      },
    ],

    runs: [
      // The grapevine: from two metres inside the gate up to the front wall of
      // the house, so you walk the whole length of it to reach the door.
      {
        id: "pergola-vine",
        kind: "pergola",
        path: [
          [0, 2],
          [0, 21.4],
        ],
        width: 3.6,
        height: 2.6,
        spacing: 2.4,
        material: "steel-dark",
        climber: "vine-green",
      },
      // The porch: posts along its open west and south edges, carrying the
      // zinc roof above.
      {
        id: "porch-posts",
        kind: "colonnade",
        path: [
          [-9.5, 23],
          [-9.5, 31],
        ],
        width: 0.3,
        height: PORCH_EAVE,
        spacing: 2.6,
        material: "steel-dark",
      },
      {
        id: "hedge-west",
        kind: "hedge",
        path: [
          [-PLOT_HALF_WIDTH, 0.4],
          [-PLOT_HALF_WIDTH, PLOT_DEPTH],
        ],
        width: 0.9,
        height: 1.7,
        material: "hedge-green",
      },
      {
        id: "hedge-east",
        kind: "hedge",
        path: [
          [PLOT_HALF_WIDTH, 0.4],
          [PLOT_HALF_WIDTH, PLOT_DEPTH],
        ],
        width: 0.9,
        height: 1.7,
        material: "hedge-green",
      },
    ],

    placements: [
      // A bench under the vine and a table out on the grass. Deliberately a
      // little above the ground — drop-to-floor is what settles them.
      //
      // There is no fountain: Poly Haven has none, and the pond reads perfectly
      // well on its own. A proxy box in the middle of the water read worse than
      // nothing at all.
      { id: "bench-vine", asset: "polyhaven/painted_wooden_bench", position: [-1.2, 0.5, 12.0], rotationY: 90 },
      { id: "table-garden", asset: "polyhaven/outdoor_table_chair_set_01", position: [2.4, 0.7, 33.8], rotationY: 15 },
    ],
  },

  context: {
    scatter: [
      // Roses either side of the alley, in a strip a metre clear of the gravel.
      {
        id: "roses-west",
        // Poly Haven has no roses. `shrub_01`–`04` are temperate and read as a
        // clipped flowering border at the scale the alley is viewed from.
        assets: ["polyhaven/shrub_01", "polyhaven/shrub_02", "polyhaven/shrub_03"],
        area: rect(-4.2, 2, 1.8, 19),
        density: 26,
        seed: 11,
        height: 0.9,
        scaleRange: [0.85, 1.2],
        material: "rose-green",
      },
      {
        id: "roses-east",
        assets: ["polyhaven/shrub_02", "polyhaven/shrub_03", "polyhaven/shrub_04"],
        area: rect(2.4, 2, 1.8, 19),
        density: 26,
        seed: 12,
        height: 0.9,
        scaleRange: [0.85, 1.2],
        material: "rose-green",
      },
      // The kitchen garden: beds between the house and the greenhouse.
      {
        id: "kitchen-garden",
        assets: ["polyhaven/planter_box_01", "polyhaven/planter_box_02", "polyhaven/planter_box_03"],
        area: rect(-13, 34, 9, 10),
        density: 9,
        seed: 21,
        height: 0.5,
        scaleRange: [0.95, 1.05],
        material: "vegetable-green",
        exclude: [rect(-10.5, 35.4, 6, 7.2)],
      },
      // The orchard, planted in rows — which is the whole reason rows exist.
      {
        id: "orchard",
        // Poly Haven has no fruit trees at all. What makes this read as an
        // orchard is the row spacing, not the species.
        assets: ["polyhaven/tree_small_02"],
        area: rect(-14, 46, 28, 14),
        density: 1,
        seed: 31,
        height: 4.2,
        scaleRange: [0.9, 1.15],
        material: "orchard-green",
        arrangement: "rows",
        rowSpacing: [5.5, 4.5],
      },
    ],

    masses: [
      // Neighbours across the road, to give the front elevation something to
      // sit against.
      { id: "n-01", footprint: rect(-34, -24, 11, 9), height: 6.0, material: "render-neighbour" },
      { id: "n-02", footprint: rect(-16, -23, 10, 8), height: 5.6, material: "render-neighbour" },
      { id: "n-03", footprint: rect(4, -24, 12, 9), height: 6.4, material: "render-neighbour" },
      { id: "n-04", footprint: rect(24, -23, 10, 8), height: 5.8, material: "render-neighbour" },
    ],

    roads: [
      {
        id: "road",
        path: [
          [-70, -5],
          [-20, -4.8],
          [20, -5.1],
          [70, -4.9],
        ],
        width: 6,
        material: "asphalt-road",
      },
      // The alley: through the gate, up to the front of the house, with a spur
      // east to the garage door.
      {
        id: "alley",
        path: [
          [0, -1.5],
          [0, 21.2],
        ],
        width: 3.2,
        material: "gravel-alley",
      },
      {
        id: "alley-garage",
        path: [
          [0, 16.5],
          [5.5, 17.6],
          [9.5, 19.4],
        ],
        width: 3.0,
        material: "gravel-alley",
      },
    ],
  },

  shots: [
    {
      id: "overview",
      name: "Overview",
      // The whole plot from above the road: gate and wall at the front, the
      // pergola running up the middle, garage right, porch and greenhouse left,
      // orchard at the back.
      camera: { position: [40, 34, -22], target: [0, 0, 28], focalLength: 30 },
      render: { width: 1920, height: 1080, samples: 1200 },
    },
    {
      id: "approach",
      name: "Approach from the gate",
      // Standing just inside the gate at eye height, on the alley's centreline
      // and *short* of the pergola's first bay — from under it the canopy fills
      // the frame and the house is behind a ceiling. The target sits slightly
      // below the lens so the vine reads as a soffit across the top of the
      // frame rather than as the subject, and the vanishing point stays on the
      // front door.
      camera: { position: [0, 1.72, 0.8], target: [0, 1.55, 23], focalLength: 35 },
      render: { width: 1920, height: 1080, samples: 2000 },
    },
    {
      id: "garden-threequarter",
      name: "Garden three-quarter",
      // From behind the pond, looking back at the garden elevation with the
      // greenhouse to the left and the orchard out of frame behind.
      camera: { position: [13.5, 4.4, 41.5], target: [-1.5, 2.2, 28], focalLength: 40 },
      // The garden side faces north-east, so it is a morning elevation or it is
      // nothing.
      solar: { date: "2026-09-12", time: "08:40", hdri: "kloppenheim_02" },
      render: { width: 1920, height: 1080, samples: 2000 },
    },
    {
      id: "porch-evening",
      name: "Porch, evening",
      camera: { position: [-16.5, 2.6, 19.5], target: [-7.5, 2.1, 27], focalLength: 50 },
      // The porch faces north-west: its light is the last hour of the day.
      solar: { date: "2026-09-12", time: "18:35", hdri: "kloppenheim_02" },
      render: { width: 1920, height: 1080, samples: 2500 },
    },
  ],
};

export default greenhollow;
