import { z } from "zod";
import { AssetId, Id, MaterialId } from "./ids.js";

/* ── shared shapes ─────────────────────────────────────────────── */

/**
 * The furthest any coordinate may sit from the origin, in metres.
 *
 * A site is a place, not the solar system. 100 km is already absurd for a
 * building — it is Bucharest to Ploiești and back — and being finite is what
 * matters: `z.number()` rejects NaN and Infinity but accepts 1e15, where
 * `1e15 + 0.001 === 1e15` in float64. Any lattice stepping by less than an
 * ULP of its own start point does not advance and therefore does not
 * terminate. Not slowly: never, with no allocation and no error to catch.
 *
 * At 1e5 a millimetre is still ~1e11 times the ULP, so the failure is not
 * merely unlikely at this bound — it is arithmetically unreachable.
 */
export const MAX_COORDINATE = 100_000;

const Coordinate = z.number().finite().min(-MAX_COORDINATE).max(MAX_COORDINATE);

/** `[x, z]` — plan space, because Y is up. */
export const PlanSchema = z.tuple([Coordinate, Coordinate]);
/** `[x, y, z]` — world space. */
export const WorldSchema = z.tuple([Coordinate, Coordinate, Coordinate]);
/** A closed polygon; the edge from last back to first is implicit. */
export const PolygonSchema = PlanSchema.array().min(3);

const Meters = z.number().finite();
const PositiveMeters = z.number().finite().positive();
const PositiveMetersOrUndefined = z.number().finite().positive().optional();
const PositiveSeconds = z.number().finite().positive();
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
  /**
   * Metres covered by one repeat of the texture.
   *
   * Geometry here is built from boxes and extrusions, which carry 0–1 UVs across
   * each face whatever its size — so without a world-scaled projection one brick
   * stretches across a 6.4 m wall and the same brick is squeezed onto a 0.9 m
   * pier. This is the number that projection uses, and it is a property of the
   * material because it describes the real-world size of what the texture shows.
   */
  textureScale: PositiveMetersOrUndefined,
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

/**
 * A named space inside a level.
 *
 * A room is a **claim about** the space the walls make, not a replacement for
 * the walls — nothing is generated from it and no partition is derived. It
 * exists because the plan was previously only the negative space between
 * partitions: nothing named it, nothing knew its area, and so nothing could
 * check that a house asked to have three bedrooms still had three bedrooms.
 *
 * `use` is an enum and not free text, and that is what makes the rules
 * possible. "Dormitor 2" tells a linter nothing; `use: "bed"` tells it the
 * space needs a window and a door and a plausible floor area. The name is for
 * the drawing; the use is for the checks.
 */
export const Room = z.strictObject({
  id: Id,
  /** What a person calls it, and what a plan labels it. */
  name: z.string().min(1),
  use: z.enum(["living", "bed", "kitchen", "bath", "hall", "store", "utility"]),
  /**
   * The clear internal outline, to the faces of the walls around it.
   *
   * Not the centrelines: a schedule of areas quotes usable floor, which is what
   * a person stands on. Area is **derived** from this and never stored — a
   * stored area is a second copy of the polygon, and the two drift.
   */
  polygon: PolygonSchema,
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
  rooms: Room.array().default([]),
});

export const Roof = z.strictObject({
  id: Id,
  kind: z.enum(["gable", "hip", "flat"]),
  footprint: PolygonSchema,
  /** Eave height, relative to site datum. */
  baseElevation: Meters,
  /** Roof pitch. Must be 0 for `flat`. */
  pitch: Degrees.min(0).max(85).default(30),
  /**
   * The **least** the declared `footprint` oversails the walls beneath it, on
   * any one side.
   *
   * Descriptive, not generative: `buildRoof` builds straight from `footprint`
   * and never reads this. The author draws the roof at its true extent, and
   * this states what that drawing is supposed to achieve, so a linter can catch
   * a footprint that no longer matches the intent.
   *
   * Settled on 2026-09-12, because three scenes had used it three ways — one
   * where it matched, one where the footprint was the walls exactly (no eave
   * anywhere, despite declaring 0.15) and one where the drawing oversailed by
   * twice what it declared. A roof that must be flush on one side — a
   * mid-terrace against its party walls — declares 0 and carries its real eave
   * in the footprint.
   */
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
  /**
   * Instances per 100 m² of `area`.
   *
   * Capped at 1 000 — ten per square metre, which is denser than any planting
   * a person would describe and still leaves a lawn's worth of headroom. The
   * cap is not the real guard (that is `scatter-density-is-sane`, which counts
   * actual instances against the budget); it is the one that holds when a
   * misplaced exponent makes the polygon's size irrelevant. These documents are
   * AI-authored, so `1e9` is not an exotic adversarial input — it is the
   * expected typo, and it used to reach the sampler as 4 × 10¹¹ attempts.
   */
  density: z.number().finite().positive().max(1_000),
  /**
   * Deterministic placement — the same seed must give the same forest.
   *
   * Defaulting to 0 is safe because the field's **id** is mixed in before the
   * RNG sees it (`scatterSeed`). It was not: two fields over one polygon that
   * both omitted this placed every instance at identical coordinates.
   */
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
  /**
   * `[along, across]` row spacing in metres. Only read when `arrangement` is
   * `rows`.
   *
   * Floored at 10 cm for the same reason `density` has a ceiling: the lattice
   * has one cell per spacing² of the field's bounds, so a spacing of 1e-6 over
   * a 100 m field is 10²² cells. Nothing downstream can refuse that in time to
   * matter, and no planting has rows a millimetre apart.
   */
  rowSpacing: z.tuple([PositiveMeters.min(0.1), PositiveMeters.min(0.1)]).default([6, 6]),
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
  /**
   * Ridge direction, in plan degrees clockwise from +Z — the same meaning as
   * `Roof.ridgeBearing`, and omitted the same way to mean "along the long axis".
   *
   * A context mass could declare that it was gabled but not which way it ran,
   * so it always fell back to the long-axis guess. For a terrace that guess is
   * wrong by ninety degrees: neighbours 6.5 m wide and 9.2 m deep get their
   * ridges running front-to-back and present gable ends to the street, while
   * the subject's own roof runs along the row. The two could never line up,
   * which is the one thing a row of terraced houses has to do.
   */
  ridgeBearing: Degrees.optional(),
  material: MaterialId,
});

export const RoadNetwork = z.strictObject({
  id: Id,
  /** Centreline. Not closed. */
  path: PlanSchema.array().min(2),
  width: PositiveMeters,
  material: MaterialId,
});

/**
 * A paved area on the ground: a courtyard, a drive, a footpath, an apron.
 *
 * Not a `Slab` and not a `RoadNetwork`, and the difference is not pedantry.
 * A slab is a **building's floor** — it belongs to a level and
 * `roof-covers-walls` reads it to decide whether a roof shelters something. A
 * road is a **ribbon** swept from a centreline, which is the right model for a
 * carriageway and the wrong one for a courtyard with a corner cut off it.
 * Paving is a polygon lying on the ground, in the context tier, because it is
 * site rather than building.
 *
 * It exists because everything a person walks on at Greenhollow was lawn. In a
 * Banat yard that is not merely unfinished, it is wrong: those courtyards are
 * traditionally *paved with brick and stone, for letting the earth breathe, and
 * not by cement, which brings dampness to the houses* — a permeable-paving
 * argument made a couple of centuries before the phrase existed, and the reason
 * the courtyard here is brick and only the car track is gravel.
 */
export const Paving = z.strictObject({
  id: Id,
  polygon: PolygonSchema,
  material: MaterialId,
  /**
   * How proud of the terrain it sits, in metres.
   *
   * Small and non-zero on purpose: coplanar with the ground is z-fighting, and
   * a kerb you can trip over is not a courtyard. 20–60 mm is the range a laid
   * surface actually stands above the earth beside it.
   */
  thickness: PositiveMeters.max(0.5).default(0.04),
});

export const Context = z.strictObject({
  paving: Paving.array().default([]),
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

/* ── animation ─────────────────────────────────────────────────── */

export const Easing = z.enum(["linear", "in", "out", "inOut"]);

export const Keyframe = z.strictObject({
  /** Seconds along the track. */
  at: z.number().finite().nonnegative(),
  value: z.number().finite(),
  /** How the value approaches this keyframe from the one before it. */
  easing: Easing.default("inOut"),
});

/**
 * One animated property.
 *
 * `target` is an enum rather than a free path because these documents are
 * written by a language model: a typo in a dotted string is a track that
 * silently drives nothing, and a typo in an enum fails at parse. The set grows
 * as the generator learns to read more of them — camera and placement
 * transforms next — and growing it is additive, so it does not bump the schema.
 */
export const Track = z.strictObject({
  id: Id,
  /** Minutes past local midnight. Solar time is already a single scalar. */
  target: z.enum(["solar.minutes"]),
  keyframes: Keyframe.array().min(2),
});

export const Animation = z.strictObject({
  /** Length of the timeline, in seconds. */
  duration: PositiveSeconds,
  loop: z.boolean().default(false),
  tracks: Track.array().default([]),
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
  /**
   * Animation time, as distinct from solar time — the playhead a track is
   * keyframed against. Optional: most scenes are stills, and a document with no
   * animation should not carry an empty one.
   */
  animation: Animation.optional(),
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
export type Keyframe = z.infer<typeof Keyframe>;
export type Paving = z.infer<typeof Paving>;
export type Room = z.infer<typeof Room>;
export type Track = z.infer<typeof Track>;
export type Animation = z.infer<typeof Animation>;
export type Easing = z.infer<typeof Easing>;
export type SceneDocument = z.infer<typeof SceneDocument>;
/** What an author writes, before defaults are applied. */
export type SceneDocumentInput = z.input<typeof SceneDocument>;
