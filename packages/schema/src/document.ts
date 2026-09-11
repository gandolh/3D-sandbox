import { z } from "zod";
import { AssetId, Id, MaterialId } from "./ids.js";

/* ── shared shapes ─────────────────────────────────────────────── */

/** `[x, z]` — plan space, because Y is up. */
export const PlanSchema = z.tuple([z.number(), z.number()]);
/** `[x, y, z]` — world space. */
export const WorldSchema = z.tuple([z.number(), z.number(), z.number()]);
/** A closed polygon; the edge from last back to first is implicit. */
export const PolygonSchema = PlanSchema.array().min(3);

const Meters = z.number().finite();
const PositiveMeters = z.number().finite().positive();
const Degrees = z.number().finite();

/* ── materials ─────────────────────────────────────────────────── */

export const Material = z.strictObject({
  label: z.string().min(1),
  /** Where the maps come from. `procedural` means no texture set at all. */
  source: z.enum(["polyhaven", "ambientcg", "procedural"]),
  /** Asset slug at the source, e.g. `plaster_brick_pattern`. */
  slug: z.string().max(128).optional(),
  /**
   * sRGB hex. The whole surface when `source` is `procedural`, and the
   * stand-in until the maps are downloaded when it is not — so a textured
   * material should still declare its dominant colour. Without one every
   * untextured material resolves to the same neutral grey, and a scene of
   * grass, tile, gravel and zinc comes out one flat colour.
   */
  baseColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  roughness: z.number().min(0).max(1).optional(),
  metalness: z.number().min(0).max(1).optional(),
});

/* ── subject tier ──────────────────────────────────────────────── */

export const Opening = z.strictObject({
  id: Id,
  kind: z.enum(["window", "door"]),
  /** Distance along the host wall from its `start`, to the opening's near edge. */
  offset: PositiveMeters,
  width: PositiveMeters,
  height: PositiveMeters,
  /** Height of the opening's base above the wall's base. Doors are 0. */
  sill: Meters.min(0).default(0),
  material: MaterialId.optional(),
});

export const Wall = z.strictObject({
  id: Id,
  start: PlanSchema,
  end: PlanSchema,
  /** Overrides the level height when present. */
  height: PositiveMeters.optional(),
  thickness: PositiveMeters.default(0.24),
  material: MaterialId,
  openings: Opening.array().default([]),
});

export const Slab = z.strictObject({
  id: Id,
  polygon: PolygonSchema,
  thickness: PositiveMeters.default(0.25),
  material: MaterialId,
});

export const Level = z.strictObject({
  id: Id,
  name: z.string().min(1),
  /** Finished floor level, relative to site datum. */
  elevation: Meters,
  /** Default wall height for this level. */
  height: PositiveMeters,
  walls: Wall.array().default([]),
  slabs: Slab.array().default([]),
});

export const Roof = z.strictObject({
  id: Id,
  kind: z.enum(["gable", "hip", "flat"]),
  footprint: PolygonSchema,
  /** Eave height, relative to site datum. */
  baseElevation: Meters,
  /** Roof pitch. Must be 0 for `flat`. */
  pitch: Degrees.min(0).max(85).default(30),
  /** How far the roof oversails the walls. */
  overhang: Meters.min(0).default(0.4),
  /** Ridge direction for `gable`, in plan degrees clockwise from +Z (north). */
  ridgeBearing: Degrees.optional(),
  material: MaterialId,
});

export const Placement = z.strictObject({
  id: Id,
  asset: AssetId,
  position: WorldSchema,
  rotationY: Degrees.default(0),
  scale: z.number().finite().positive().default(1),
});

/**
 * A linear feature: a hedge, a fence, a colonnade, or a pergola.
 *
 * All four are the same idea — a profile carried along a path — and differ only
 * in what is placed along it. A hedge is solid; the rest stand posts at
 * `spacing` carrying a head beam, and a pergola adds rafters across them (and,
 * with a `climber`, a vine over those). A colonnade is the porch case: posts
 * holding up the edge of a roof. They are not `Wall`s:
 * a wall is a building element that lives inside a level and is checked against
 * the roof over it, and a hedge has neither a level nor a roof.
 */
export const Run = z.strictObject({
  id: Id,
  kind: z.enum(["hedge", "fence", "colonnade", "pergola"]),
  /** Centreline. Not closed — repeat the first point to close it deliberately. */
  path: PlanSchema.array().min(2),
  width: PositiveMeters,
  height: PositiveMeters,
  /** Post pitch along the path. Ignored by `hedge`, which is continuous. */
  spacing: PositiveMeters.default(3),
  material: MaterialId,
  /** A climber trained over a pergola — the grapevine on the metalwork. */
  climber: MaterialId.optional(),
});

export const Subject = z.strictObject({
  levels: Level.array().default([]),
  roofs: Roof.array().default([]),
  placements: Placement.array().default([]),
  runs: Run.array().default([]),
});

/* ── context tier ──────────────────────────────────────────────── */

export const ScatterField = z.strictObject({
  id: Id,
  /** Assets picked from at random. At least one. */
  assets: AssetId.array().min(1),
  area: PolygonSchema,
  /** Instances per 100 m² of `area`. */
  density: z.number().finite().positive(),
  /** Deterministic placement — the same seed must give the same forest. */
  seed: z.number().int().nonnegative().default(0),
  /**
   * Surface for the instances. Falls back to the terrain's, which is only ever
   * right by accident — roses, an orchard and a vegetable bed are not the lawn
   * they stand on.
   */
  material: MaterialId.optional(),
  scaleRange: z.tuple([z.number().positive(), z.number().positive()]).default([0.85, 1.15]),
  /**
   * How instances are laid out. `random` is scrub, woodland, meadow; `rows` is
   * anything planted by a person — an orchard, a vineyard, a nursery bed.
   */
  arrangement: z.enum(["random", "rows"]).default("random"),
  /** `[along, across]` row spacing in metres. Only read when `arrangement` is `rows`. */
  rowSpacing: z.tuple([PositiveMeters, PositiveMeters]).default([6, 6]),
  /**
   * Nominal height of one instance, in metres, before `scaleRange`.
   *
   * A real property of the planting rather than a rendering hint — a rose bed
   * and an apple orchard differ by it — and the only thing that lets the proxy
   * geometry be the right size before the asset manifest exists. When the
   * manifest lands this becomes a check on the glTF rather than dead weight.
   */
  height: PositiveMeters.default(6),
  /** Regions kept clear, e.g. the house footprint and the driveway. */
  exclude: PolygonSchema.array().default([]),
});

export const BuildingMass = z.strictObject({
  id: Id,
  footprint: PolygonSchema,
  height: PositiveMeters,
  roofKind: z.enum(["gable", "hip", "flat"]).default("gable"),
  pitch: Degrees.min(0).max(85).default(30),
  material: MaterialId,
});

export const RoadNetwork = z.strictObject({
  id: Id,
  /** Centreline. Not closed. */
  path: PlanSchema.array().min(2),
  width: PositiveMeters,
  material: MaterialId,
});

export const Context = z.strictObject({
  scatter: ScatterField.array().default([]),
  masses: BuildingMass.array().default([]),
  roads: RoadNetwork.array().default([]),
});

/* ── site, solar, shots ────────────────────────────────────────── */

export const Terrain = z.strictObject({
  kind: z.enum(["flat", "heightfield"]),
  /** Extent in metres, `[x, z]`, centred on the origin. */
  size: z.tuple([PositiveMeters, PositiveMeters]).default([120, 120]),
  material: MaterialId,
  /** Row-major samples for `heightfield`; resolution is inferred as a square. */
  heights: z.number().array().optional(),
});

export const Site = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** IANA zone, used to resolve local clock time to a sun position. */
  timezone: z.string().min(1),
  /** Scene +Z is true north rotated by this many degrees. */
  northOffset: Degrees.default(0),
  terrain: Terrain,
});

export const SolarTime = z.strictObject({
  date: z.iso.date(),
  /** Local clock time at the site, `HH:MM`. */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM"),
  /** Poly Haven HDRI slug providing image-based lighting. */
  hdri: z.string().max(128).optional(),
});

export const Shot = z.strictObject({
  id: Id,
  name: z.string().min(1),
  camera: z.strictObject({
    position: WorldSchema,
    target: WorldSchema,
    /** 35 mm-equivalent focal length. */
    focalLength: z.number().positive().default(35),
  }),
  /** Overrides the document's working solar time when rendering this shot. */
  solar: SolarTime.optional(),
  render: z
    .strictObject({
      width: z.number().int().positive().max(8192).default(1920),
      height: z.number().int().positive().max(8192).default(1080),
      samples: z.number().int().positive().max(20000).default(2000),
    })
    .default({ width: 1920, height: 1080, samples: 2000 }),
});

/* ── the document ──────────────────────────────────────────────── */

export const SCHEMA_VERSION = 1;

export const SceneDocument = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: Id,
  title: z.string().min(1),
  site: Site,
  /** The working solar moment — what the editor opens to. */
  solar: SolarTime,
  materials: z.record(MaterialId, Material),
  // `prefault`, not `default`: Zod 4's `.default()` hands back the literal
  // value without re-parsing it, so `.default({})` would leave the inner
  // array defaults unapplied and every consumer reading `undefined`.
  subject: Subject.prefault({}),
  context: Context.prefault({}),
  shots: Shot.array().default([]),
});

export type Material = z.infer<typeof Material>;
export type Opening = z.infer<typeof Opening>;
export type Wall = z.infer<typeof Wall>;
export type Slab = z.infer<typeof Slab>;
export type Level = z.infer<typeof Level>;
export type Roof = z.infer<typeof Roof>;
export type Placement = z.infer<typeof Placement>;
export type Subject = z.infer<typeof Subject>;
export type ScatterField = z.infer<typeof ScatterField>;
export type BuildingMass = z.infer<typeof BuildingMass>;
export type RoadNetwork = z.infer<typeof RoadNetwork>;
export type Context = z.infer<typeof Context>;
export type Terrain = z.infer<typeof Terrain>;
export type Site = z.infer<typeof Site>;
export type SolarTime = z.infer<typeof SolarTime>;
export type Shot = z.infer<typeof Shot>;
export type Run = z.infer<typeof Run>;
export type SceneDocument = z.infer<typeof SceneDocument>;
/** What an author writes, before defaults are applied. */
export type SceneDocumentInput = z.input<typeof SceneDocument>;
