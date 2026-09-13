/**
 * Villa Carpathia — the reference scene.
 *
 * A single-storey gabled house on a wooded plot outside Bucharest, with a
 * street and a handful of neighbouring masses as context. It exists to
 * exercise every part of the schema at least once, so it is deliberately
 * complete rather than minimal.
 */
import {
  doorOpening,
  type PlanInput,
  rect,
  type SceneDocumentInput,
  wallsFromFootprint,
  windowOpening,
  withOpenings,
} from "@solstice/schema";

const WALL_MATERIAL = "plaster-lime-04";
const FOOTPRINT = rect(-3.2, -4.8, 6.4, 9.6);
const EAVE = 2.7;

// Walls run anticlockwise from the south-west corner, so W-01 faces the street
// and W-03 — the one the inspector mockup selects — faces the garden.
let walls = wallsFromFootprint(FOOTPRINT, {
  material: WALL_MATERIAL,
  thickness: 0.24,
});

walls = withOpenings(walls, "W-01", [doorOpening("d-01", 2.7, 1.0, 2.1)]);
walls = withOpenings(walls, "W-02", [
  windowOpening("w-21", 1.6, 1.4, 1.2, 0.9),
  windowOpening("w-22", 6.6, 1.4, 1.2, 0.9),
]);
walls = withOpenings(walls, "W-03", [
  windowOpening("w-11", 1.1, 1.4, 1.2, 0.9),
  windowOpening("w-12", 3.9, 1.4, 1.2, 0.9),
]);

/**
 * The neighbours, named once so the forest can be told where they are.
 *
 * Declared above the document because `context.scatter` has to exclude them and
 * `context.masses` has to place them, and two hand-copied lists of the same six
 * rectangles is how they drift apart.
 */
const NEIGHBOURS = [
  { id: "n-01", footprint: rect(-46, 22, 11, 9), height: 6.2, material: "render-neighbour" },
  { id: "n-02", footprint: rect(-30, 24, 10, 8), height: 5.8, material: "render-neighbour" },
  { id: "n-03", footprint: rect(-13, 23, 12, 9), height: 6.6, material: "render-neighbour" },
  { id: "n-04", footprint: rect(6, 24, 10, 8), height: 5.4, material: "render-neighbour" },
  { id: "n-05", footprint: rect(23, 22, 11, 10), height: 7.1, material: "render-neighbour" },
  { id: "n-06", footprint: rect(40, 25, 9, 8), height: 5.6, material: "render-neighbour" },
];

/** A rectangle grown by `margin` on every side. */
const grown = (footprint: PlanInput[], margin: number): PlanInput[] => {
  const xs = footprint.map(([x]) => x);
  const zs = footprint.map(([, z]) => z);
  const minX = Math.min(...xs) - margin;
  const minZ = Math.min(...zs) - margin;
  return rect(minX, minZ, Math.max(...xs) + margin - minX, Math.max(...zs) + margin - minZ);
};

const villa: SceneDocumentInput = {
  schemaVersion: 1,
  id: "villa-carpathia",
  title: "Villa Carpathia",

  site: {
    latitude: 44.4268,
    longitude: 26.1025,
    timezone: "Europe/Bucharest",
    northOffset: 0,
    terrain: { kind: "flat", size: [140, 140], material: "grass-meadow" },
  },

  // 21 June, late afternoon: sun altitude 32.9°, azimuth 271.7° (suncalc,
  // refraction-corrected). Sun in the west, so shadows fall east.
  solar: { date: "2026-06-21", time: "17:42", hdri: "kloppenheim_06" },

  // Every material declares its dominant colour and a world-metre texture
  // scale, whether or not it names a texture — the rule settled on 2026-09-11.
  // Without the colour, a machine with no assets downloaded renders the walls,
  // roof, ground and road the same neutral grey; without the scale, one
  // clay-plaster repeat smears across a 9.6 m wall and the 140 m meadow gets a
  // single blade of grass. Values match Greenhollow's so the two scenes are
  // comparable.
  materials: {
    [WALL_MATERIAL]: {
      label: "Lime Plaster 04",
      source: "polyhaven",
      slug: "clay_plaster",
      baseColor: "#E9E1D3",
      textureScale: 2.4,
      roughness: 0.82,
    },
    "roof-clay-tile": {
      label: "Clay Roof Tile",
      source: "polyhaven",
      slug: "roof_tiles_14",
      baseColor: "#9C5540",
      textureScale: 1.6,
      roughness: 0.68,
    },
    "slab-concrete": {
      label: "Board-formed Concrete",
      source: "ambientcg",
      slug: "Concrete034",
      baseColor: "#B9B5AD",
      textureScale: 3.0,
      roughness: 0.9,
    },
    "grass-meadow": {
      label: "Meadow Grass",
      source: "polyhaven",
      slug: "leafy_grass",
      baseColor: "#5C7B43",
      textureScale: 4.0,
      roughness: 1,
    },
    "asphalt-road": {
      label: "Worn Asphalt",
      source: "ambientcg",
      slug: "Asphalt026A",
      baseColor: "#47474A",
      textureScale: 4.0,
      roughness: 0.95,
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
        id: "ground-floor",
        name: "Ground Floor",
        elevation: 0,
        height: EAVE,
        walls,
        slabs: [{ id: "slab-ground", polygon: FOOTPRINT, thickness: 0.25, material: "slab-concrete" }],
      },
    ],
    roofs: [
      {
        id: "roof-main",
        kind: "gable",
        footprint: rect(-3.6, -5.2, 7.2, 10.4),
        baseElevation: EAVE,
        pitch: 32,
        overhang: 0.4,
        ridgeBearing: 0,
        material: "roof-clay-tile",
      },
    ],
    // Positions are deliberately imperfect — the drop-to-floor aid exists to
    // settle them, and a scene where everything is already at y = 0 proves
    // nothing.
    placements: [
      { id: "chair-01", asset: "polyhaven/ArmChair_01", position: [-1.6, 1.4, 2.2], rotationY: 24 },
      { id: "chair-02", asset: "polyhaven/ArmChair_01", position: [1.5, 0.9, 2.6], rotationY: -140 },
      {
        id: "table-01",
        asset: "polyhaven/CoffeeTable_01",
        position: [0, 2.1, 1.1],
        rotationY: 0,
        scale: 1.2,
      },
    ],
  },

  context: {
    // 14 400 m² of plot, less an 896 m² clearing around the house and the six
    // neighbours' own plots, at 2.1 instances per 100 m² — 260 trees, well
    // inside the 4 000 budget.
    scatter: [
      {
        id: "forest",
        assets: ["polyhaven/pine_tree_01", "polyhaven/fir_tree_01", "polyhaven/tree_small_02"],
        area: rect(-60, -60, 120, 120),
        density: 2.1,
        seed: 20260621,
        scaleRange: [0.8, 1.25],
        // The house clearing, and every neighbour — each with a 2 m skirt, so
        // trees do not touch the walls either. Without these the forest grew
        // straight through all six: n-03 alone is 108 m², which at this
        // density puts about two trees inside its rooms.
        exclude: [rect(-14, -16, 28, 32), ...NEIGHBOURS.map((n) => grown(n.footprint, 2))],
      },
    ],
    masses: NEIGHBOURS,
    roads: [
      {
        id: "street",
        path: [
          [-60, 17],
          [-20, 17.4],
          [20, 17.2],
          [60, 17.6],
        ],
        width: 6,
        material: "asphalt-road",
      },
    ],
  },

  shots: [
    {
      id: "sw-threequarter",
      name: "South-west",
      camera: { position: [-14.5, 6.2, -12.8], target: [0, 2.4, 0], focalLength: 35 },
      render: { width: 1920, height: 1080, samples: 600 },
    },
    {
      id: "garden-elevation",
      name: "Garden elevation",
      camera: { position: [0, 3.2, 22], target: [0, 2.6, 0], focalLength: 85 },
      solar: { date: "2026-06-21", time: "07:15", hdri: "kloppenheim_02" },
      render: { width: 2560, height: 1440, samples: 600 },
    },
  ],
};

export default villa;
