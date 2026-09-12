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

/**
 * The house: 11 × 12 m, grown 2 m south of where it first stood.
 *
 * The footprint follows the brief rather than the other way round. A 98 m²
 * interior cannot hold a big living room, a kitchen, a bathroom and three
 * bedrooms without lying about one of them — the arithmetic runs out at two
 * bedrooms — so the plan asked for 2 m more depth and got it. Growing *south*,
 * toward the road, is the only direction available: the porch holds the west,
 * the garage the east, and the kitchen garden and the pond the north.
 */
const HOUSE = rect(-5.5, 20, 11, 12);

/**
 * Where the internal walls run, in metres.
 *
 * The plan is a **central-hall type**: one spine from the front door to the
 * living room, rooms either side, no room passing through another. That is the
 * Banat *tindă* — the hall that reaches every room and the attic — and it is
 * also what an American Foursquare does with its central core. Both traditions
 * arrive at it for the same reason: on a squarish plan it is the shortest
 * circulation that still gives every room two external walls.
 *
 * Zoning follows served/servant: kitchen and bathroom are stacked on the east
 * side, back to back across `WET`, so all the plumbing is in one wall. The
 * bedrooms take the quiet west and the north-east corner; the living room takes
 * the north gable, which is where the garden, the pond and the orchard are.
 *
 * Clear dimensions, with 0.12 partitions centred on these lines.
 */
const SPINE_W = -0.6; // hall's west wall
const SPINE_E = 1.2; // hall's east wall
const BED_1_2 = 23.9; // between the two west bedrooms
const WET = 24.3; // kitchen | bathroom, the one plumbing wall
const DAY = 27.4; // the sleeping/serving half | the living room
const BED_3_W = 2.0; // living room | north-east bedroom
const PORCH = rect(-9.5, 23, 4, 8);
const GARAGE = rect(7, 20, 7, 7);
const GREENHOUSE = rect(-10, 36, 5, 6);

/* ── walls ─────────────────────────────────────────────────────── */

// The house: walls run anticlockwise from the south-west corner, so W-01 is the
// street-facing front — the wall the pergola arrives at.
let houseWalls = wallsFromFootprint(HOUSE, { material: "plaster-lime", thickness: 0.3 });

/**
 * The street gable, and the one rule it obeys.
 *
 * The ridge runs north–south, so this is a **gable end facing the road** — the
 * pattern across the Banat and most of central Europe, where the narrow, tall,
 * decorated end is the face the village sees and the long eaved side is
 * private. The door is not central: it lands on the hall, which sits east of
 * the middle, and the two living-room windows are then spaced evenly about the
 * *living room's* own centre rather than the wall's. A front that is symmetric
 * about a room it does not contain is the commonest tell of a plan drawn
 * elevation-first.
 *
 * Offsets are measured from x = −5.5.
 */
houseWalls = withOpenings(houseWalls, "W-01", [
  windowOpening("w-f1", 0.65, 1.5, 1.45, 0.85), // bedroom 1, at x −4.85
  windowOpening("w-f2", 3.15, 1.5, 1.45, 0.85), // bedroom 1, at x −2.35
  doorOpening("d-front", 6.1, 1.2, 2.3), // the hall, at x 0.6…1.8
  windowOpening("w-f3", 8.65, 1.2, 1.45, 0.85), // kitchen, at x 3.15
]);

/**
 * The east flank, facing the alley and the garage.
 *
 * The working side of the house, so the openings answer to the rooms behind
 * them rather than to a rhythm: a wide kitchen window over where a sink goes, a
 * small high one to the bathroom for privacy, and a full window to the
 * north-east bedroom. Offsets from z = 20.
 */
houseWalls = withOpenings(houseWalls, "W-02", [
  windowOpening("w-e1", 1.9, 1.6, 1.3, 0.95), // kitchen
  windowOpening("w-e2", 5.0, 0.7, 0.6, 1.75), // bathroom, high and small
  windowOpening("w-e3", 8.6, 1.3, 1.45, 0.85), // bedroom 3
]);

/**
 * The garden gable: the living room's face, and the best one.
 *
 * Everything here is bigger than anywhere else on the house, because this is
 * the wall the pond, the orchard and the evening sit in front of. The garden
 * door is not centred on the wall either — it is centred on the living room,
 * which stops 2 m short of the east corner where bedroom 3 is. Offsets from
 * x = 5.5 running west.
 */
houseWalls = withOpenings(houseWalls, "W-03", [
  windowOpening("w-g1", 1.25, 1.3, 1.45, 0.85), // bedroom 3, at x 3.6
  windowOpening("w-g2", 3.7, 2.4, 1.9, 0.55), // living room, east of the door
  doorOpening("d-garden", 6.4, 1.4, 2.3), // living room, centred on the room at x −1.6
  windowOpening("w-g3", 8.1, 2.4, 1.9, 0.55), // living room, west of the door
]);

/**
 * The west flank, under the porch.
 *
 * This is the *prispă* side — the long, eaved, shaded elevation the porch runs
 * along, which in the vernacular is where the household actually lives in
 * summer. So it gets a second door: you step off the porch straight into the
 * living room, which is the move the whole type is built around. The two
 * bedroom windows below it are small and high-silled, facing the afternoon sun.
 * Offsets from z = 32 running south.
 */
houseWalls = withOpenings(houseWalls, "W-04", [
  doorOpening("d-porch", 1.8, 1.1, 2.3), // living room, off the porch
  windowOpening("w-p1", 5.6, 1.2, 1.3, 0.95), // bedroom 2
  windowOpening("w-p2", 9.1, 1.2, 1.3, 0.95), // bedroom 1
]);

/**
 * The partitions, and the chimney.
 *
 * Internal walls are 0.12 — a single leaf, plastered both sides — against the
 * 0.30 of the external envelope, which is the honest ratio for a masonry house
 * and reads immediately in plan.
 *
 * The stack is the one piece of the house that is not a partition. It is
 * modelled as a short, very thick wall carried up past the ridge, and it is
 * placed **inside** the plan rather than on a gable: an internal flue stays
 * within the thermal envelope, so its mass radiates into the house overnight
 * instead of into the weather, it drafts better for being warm, and it
 * penetrates the roof near the ridge where the flashing is simplest. Every
 * tradition that had to survive a winter put it there. A stack strapped to an
 * outside wall is a nineteenth-century convenience, not a first principle.
 *
 * It sits on the living room's south wall at x ≈ 0.3 — a metre off the ridge,
 * back-to-back with the hall, so one mass warms both.
 */
const INTERNAL = { material: "plaster-lime", thickness: 0.12, height: HOUSE_EAVE } as const;
const partition = (
  id: string,
  start: [number, number],
  end: [number, number],
  openings: WallSpec["openings"] = [],
): WallSpec => ({ id, start, end, ...INTERNAL, openings });

const houseInternals: WallSpec[] = [
  // The spine: hall's west wall, with the two bedroom doors off it.
  partition("P-hall-w", [SPINE_W, 20.3], [SPINE_W, DAY], [
    doorOpening("d-bed1", 1.6, 0.9, 2.1),
    doorOpening("d-bed2", 5.2, 0.9, 2.1),
  ]),
  // The spine's east wall, with the kitchen and bathroom doors.
  partition("P-hall-e", [SPINE_E, 20.3], [SPINE_E, DAY], [
    doorOpening("d-kitchen", 1.3, 0.9, 2.1),
    doorOpening("d-bath", 5.0, 0.8, 2.1),
  ]),
  // Between the two west bedrooms. No door: a bedroom reached through another
  // bedroom is the thing a central hall exists to avoid.
  partition("P-bed-1-2", [-5.2, BED_1_2], [SPINE_W, BED_1_2]),
  // Kitchen | bathroom — the plumbing wall, so both wet rooms share one stack
  // of pipes instead of running two.
  partition("P-wet", [SPINE_E, WET], [5.2, WET]),
  // The day/night line. West of the hall it closes the bedrooms off; east of it
  // the bathroom. The living-room door is the wide one, on the spine.
  partition("P-day-w", [-5.2, DAY], [SPINE_W, DAY]),
  partition("P-day-hall", [SPINE_W, DAY], [SPINE_E, DAY], [
    doorOpening("d-living", 0.3, 1.2, 2.3),
  ]),
  partition("P-day-e", [SPINE_E, DAY], [5.2, DAY]),
  // Living room | bedroom 3.
  partition("P-bed3", [BED_3_W, DAY], [BED_3_W, 31.7], [doorOpening("d-bed3", 0.6, 0.9, 2.1)]),
  // The chimney: 1.4 × 0.7 of masonry, carried to 8.4 m — clear of a ridge that
  // stands at 7.69.
  {
    id: "P-chimney",
    start: [-0.4, DAY],
    end: [1.0, DAY],
    material: "plaster-lime",
    thickness: 0.7,
    height: 8.4,
    openings: [],
  },
];
houseWalls = [...houseWalls, ...houseInternals];

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
      slug: "clay_plaster",
      baseColor: "#E9E1D3",
      textureScale: 2.4,
      roughness: 0.84,
    },
    "roof-clay-tile": {
      label: "Clay Roof Tile",
      source: "polyhaven",
      slug: "roof_tiles_14",
      baseColor: "#9C5540",
      textureScale: 1.6,
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
      textureScale: 3.0,
      roughness: 0.9,
    },
    "concrete-wall": {
      label: "Cast Concrete",
      source: "ambientcg",
      slug: "Concrete034",
      baseColor: "#C2BDB3",
      textureScale: 3.0,
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
      label: "Leafy Grass",
      source: "polyhaven",
      slug: "leafy_grass",
      baseColor: "#5C7B43",
      textureScale: 4.0,
      roughness: 1,
    },
    "gravel-alley": {
      label: "Gravel",
      source: "ambientcg",
      slug: "Gravel023",
      baseColor: "#A79D8D",
      textureScale: 2.0,
      roughness: 0.96,
    },
    "asphalt-road": {
      label: "Worn Asphalt",
      source: "ambientcg",
      slug: "Asphalt026A",
      baseColor: "#47474A",
      textureScale: 4.0,
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
        /**
         * Ridge north–south: gable to the road, eaves down the long flanks.
         *
         * The comment here used to claim exactly this while the value said
         * `90`, which is a ridge running east–west — gables facing the porch
         * and the alley, eaves over the road and the garden. The drawing had
         * been the opposite of its own description since it was written.
         *
         * `0` is also the one that is right. A gable end to the street is the
         * near-universal village pattern from the Banat to the Rhine: the
         * narrow decorated end is what the road sees, and the long private
         * flank runs back down the plot. It is what puts an **eave over the
         * porch**, which is the whole point of a porch on that side — a gable
         * there would shed its water straight down the open edge.
         *
         * Slopes now span the 12 m width, so the ridge stands at 3.0 + 12/2 ×
         * tan 38° = 7.69 m. The chimney is carried to 8.4.
         */
        footprint: rect(-6.0, 19.5, 12, 13),
        baseElevation: HOUSE_EAVE,
        pitch: 38,
        overhang: 0.5,
        ridgeBearing: 0,
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
        // 0.3, matching the footprint, which oversails the 5 × 6 m glasshouse
        // by that much on all four sides. The 0.15 declared here before
        // described nothing in the drawing.
        overhang: 0.3,
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
          [1.2, 2],
          [1.2, 19.4],
        ],
        width: 3.6,
        height: 2.6,
        spacing: 2.4,
        material: "steel-dark",
        climber: "vine-green",
      },
      // The porch: posts along its open west and south edges, carrying the
      // zinc roof above.
      //
      // The south leg used to be missing, so the roof — flat, with no walls
      // beneath it — was carried on one edge of two and its south corner read
      // as cantilevered off nothing.
      {
        id: "porch-posts",
        kind: "colonnade",
        path: [
          [-9.5, 23],
          [-9.5, 31],
          [-5.5, 31],
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
      /**
       * The hearth end of the living room.
       *
       * Two chairs and a table turned to face the chimney breast, which is what
       * makes a fireplace read as one: the mass alone is just a pier. Poly Haven
       * has no fireplace, no stove and no bed, so the firebox itself and the
       * three bedrooms stay unfurnished rather than being faked — a proxy box
       * where a hearth should be reads worse than an empty room, which is the
       * same call the pond's absent fountain got.
       */
      { id: "chair-hearth-w", asset: "polyhaven/ArmChair_01", position: [-0.75, 0, 29.5], rotationY: 152 },
      { id: "chair-hearth-e", asset: "polyhaven/ArmChair_01", position: [1.35, 0, 29.5], rotationY: 208 },
      { id: "table-hearth", asset: "polyhaven/CoffeeTable_01", position: [0.3, 0, 29.1], rotationY: 0 },
      // A bench under the vine and a table out on the grass. Deliberately a
      // little above the ground — drop-to-floor is what settles them.
      //
      // There is no fountain: Poly Haven has none, and the pond reads perfectly
      // well on its own. A proxy box in the middle of the water read worse than
      // nothing at all.
      { id: "bench-vine", asset: "polyhaven/painted_wooden_bench", position: [0, 0.5, 12.0], rotationY: 90 },
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

  /**
   * A sun-path study: 06:00 to 20:00 over twelve seconds.
   *
   * Solar time is one scalar, so the whole study is one track over it — which
   * is the reason animation time and solar time were drawn as distinct notions
   * in the first place. Eased at both ends so the low sun, where the shadows
   * are longest and most of the interest is, gets more of the twelve seconds
   * than noon does.
   */
  animation: {
    duration: 12,
    loop: true,
    tracks: [
      {
        id: "sun-path",
        target: "solar.minutes",
        keyframes: [
          { at: 0, value: 6 * 60, easing: "out" },
          { at: 6, value: 13 * 60, easing: "inOut" },
          { at: 12, value: 20 * 60, easing: "in" },
        ],
      },
    ],
  },

  // 600 samples, not the 2,000 that was invented before the renderer had ever
  // run: measured convergence says 300 is within 1.8 RMS of 1,500 and the curve
  // falls as 1/√N after that. See corpus/wiki/running-on-a-gpu.md.
  shots: [
    {
      id: "overview",
      name: "Overview",
      // The whole plot from above the road: gate and wall at the front, the
      // pergola running up the middle, garage right, porch and greenhouse left,
      // orchard at the back.
      camera: { position: [40, 34, -22], target: [0, 0, 26], focalLength: 30 },
      render: { width: 1920, height: 1080, samples: 600 },
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
      // Re-aimed when the house grew 2 m south and the door moved east with
      // the plan: the pergola, the camera and the vanishing point all sit on
      // x = 1.2 now, and the target is the gable end at z = 20 rather than a
      // point 3 m inside the living room.
      camera: { position: [1.2, 1.72, 0.8], target: [1.2, 1.6, 20], focalLength: 35 },
      render: { width: 1920, height: 1080, samples: 600 },
    },
    {
      id: "garden-threequarter",
      name: "Garden three-quarter",
      // From behind the pond, looking back at the garden elevation with the
      // greenhouse to the left and the orchard out of frame behind.
      camera: { position: [13.5, 4.4, 41.5], target: [-1.8, 2.4, 30.6], focalLength: 40 },
      // The garden side faces north-east, so it is a morning elevation or it is
      // nothing.
      solar: { date: "2026-09-12", time: "08:40", hdri: "kloppenheim_02" },
      render: { width: 1920, height: 1080, samples: 600 },
    },
    {
      id: "porch-evening",
      name: "Porch, evening",
      camera: { position: [-16.5, 2.6, 19.5], target: [-7.5, 2.1, 27], focalLength: 50 },
      // The porch faces north-west: its light is the last hour of the day.
      solar: { date: "2026-09-12", time: "18:35", hdri: "kloppenheim_02" },
      render: { width: 1920, height: 1080, samples: 600 },
    },
  ],
};

export default greenhollow;
