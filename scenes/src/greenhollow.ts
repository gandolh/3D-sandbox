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
const LARDER = 26.2; // bathroom | larder, on the servant side
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
    doorOpening("d-bath", 4.3, 0.8, 2.1),
    doorOpening("d-larder", 6.1, 0.7, 2.1),
  ]),
  // Between the two west bedrooms. No door: a bedroom reached through another
  // bedroom is the thing a central hall exists to avoid.
  partition("P-bed-1-2", [-5.2, BED_1_2], [SPINE_W, BED_1_2]),
  // Kitchen | bathroom — the plumbing wall, so both wet rooms share one stack
  // of pipes instead of running two.
  partition("P-wet", [SPINE_E, WET], [5.2, WET]),
  /**
   * Bathroom | larder.
   *
   * The servant side was one 12.2 m² room called a bathroom, which is roughly
   * twice what a bathroom is and left the house with nowhere to keep food. A
   * *cămară* is not a nicety in a farmhouse with a kitchen garden and an
   * orchard — it is where the year's produce lives.
   *
   * Split north–south rather than east–west so **both** halves keep the east
   * external wall: a bathroom with no window and a larder with no ventilation
   * are each worse than the oversized room they came from.
   */
  partition("P-larder", [SPINE_E, LARDER], [5.2, LARDER]),
  // The day/night line. West of the hall it closes the bedrooms off; east of it
  // the bathroom. The living-room door is the wide one, on the spine.
  partition("P-day-w", [-5.2, DAY], [SPINE_W, DAY]),
  partition("P-day-hall", [SPINE_W, DAY], [SPINE_E, DAY], [
    doorOpening("d-living", 0.3, 1.2, 2.3),
  ]),
  partition("P-day-e", [SPINE_E, DAY], [5.2, DAY]),
  // Living room | bedroom 3. Runs the full depth to the north wall's inner
  // face: stopping at 31.7 left a 150 mm slot joining the two rooms.
  partition("P-bed3", [BED_3_W, DAY], [BED_3_W, 31.85], [doorOpening("d-bed3", 0.6, 0.9, 2.1)]),
  /**
   * The chimney: 1.4 × 0.7 of masonry, carried to 8.4 m — clear of a ridge
   * that stands at 7.69.
   *
   * **West of the hall, not on it.** It first stood from x −0.4 to 1.0 on this
   * same line, which is exactly where `d-living` is: a 1.4 m masonry mass built
   * across the whole 1.2 m of the only door into the living room. The plan had
   * no way in. Nothing caught it because nothing in the document knew there was
   * a room on either side — which is what `Room` is for, and this is the bug
   * that found it.
   *
   * Moving it here keeps the point brief 46 made about flue placement: it still
   * sits on an **internal** wall (`P-day-w`), so the mass stays inside the
   * envelope where it gives its heat back, and it still penetrates near the
   * ridge. It is now centred on the living room's western half, which is where
   * the seating goes.
   */
  {
    id: "P-chimney",
    start: [-3.6, DAY],
    end: [-2.2, DAY],
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
 * The road boundary: one wall, with **two** gates cut out of it.
 *
 * A gate *is* an aperture in a wall, so it is an `Opening` and not a thing of
 * its own. Offsets run from x = −16.
 *
 * **Two, not one, and that is the move the whole yard turns on.** A single
 * 4 m gate makes the car and the person share one opening, and everything
 * inside it then fights for the same ground: the drive has to swing around the
 * vine walk, or the vine walk has to cross the drive. The Banat answer — and
 * the central-European one generally — is the *poartă mare* and the *portiță*:
 * a carriage gate for the cart, and a pedestrian wicket beside it.
 *
 * So the wicket lands on the house's own axis at x = 1.2, which is the front
 * door's centreline and the vine's, and the carriage gate sits east at x = 5.5,
 * on the line the drive wants in order to reach a garage at x 7…14. Neither
 * route crosses the other at any point between the road and its destination.
 * That is the segregation the layout was missing, and it costs one extra
 * opening in a wall that already existed.
 */
const WICKET_X = 1.2; // the front door's axis, and the vine's
const CARRIAGE_X = 6.0; // the drive's axis, aimed at the garage door

const boundaryWall: WallSpec = {
  id: "B-01",
  start: [-PLOT_HALF_WIDTH, 0],
  end: [PLOT_HALF_WIDTH, 0],
  material: "concrete-wall",
  thickness: 0.3,
  height: 1.8,
  openings: [
    {
      id: "wicket",
      kind: "door",
      offset: PLOT_HALF_WIDTH + WICKET_X - 0.65,
      width: 1.3,
      height: 1.8,
      sill: 0,
      material: "steel-dark",
    },
    {
      id: "gate",
      kind: "door",
      offset: PLOT_HALF_WIDTH + CARRIAGE_X - 1.9,
      width: 3.8,
      height: 1.8,
      sill: 0,
      material: "steel-dark",
    },
  ],
};


/* ── the rooms ─────────────────────────────────────────────────── */

/**
 * The seven spaces the partitions make, named.
 *
 * Every number here is **derived from the same constants the walls are built
 * from** — `SPINE_W`, `WET`, `DAY` and the rest — rather than transcribed from
 * them. A room outline typed out by hand is a second copy of the plan, and this
 * repo has watched two copies of one number drift apart often enough to stop
 * doing it. Move `WET` and the kitchen and the bathroom follow.
 *
 * Outlines run to the **inner faces**, because a schedule of areas quotes the
 * floor a person stands on: external walls are 300 mm centred on the footprint,
 * so 150 mm in; partitions are 120 mm, so 60 mm each side.
 */
const EXT = 0.15; // half the external wall
const PART = 0.06; // half a partition

/** Inner faces of the external envelope. */
const IN_W = -5.5 + EXT;
const IN_E = 5.5 - EXT;
const IN_S = 20 + EXT;
const IN_N = 32 - EXT;

const room = (
  id: string,
  name: string,
  use: "living" | "bed" | "kitchen" | "bath" | "hall" | "store" | "utility",
  x1: number,
  z1: number,
  x2: number,
  z2: number,
) => ({ id, name, use, polygon: rect(x1, z1, x2 - x1, z2 - z1) as [number, number][] });

const houseRooms = [
  /**
   * The hall — the Banat *tindă*.
   *
   * Narrow and deep on purpose: it is circulation, and every square metre it
   * takes is one a room does not get. It reaches all six other spaces, so no
   * room is entered through another.
   */
  room("r-hall", "Hall", "hall", SPINE_W + PART, IN_S, SPINE_E - PART, DAY - PART),

  // The quiet west side, both bedrooms off the hall.
  room("r-bed-1", "Bedroom 1", "bed", IN_W, IN_S, SPINE_W - PART, BED_1_2 - PART),
  room("r-bed-2", "Bedroom 2", "bed", IN_W, BED_1_2 + PART, SPINE_W - PART, DAY - PART),

  // The servant side: kitchen and bathroom back to back across the one
  // plumbing wall, so a single stack of pipes serves both.
  room("r-kitchen", "Kitchen", "kitchen", SPINE_E + PART, IN_S, IN_E, WET - PART),
  room("r-bath", "Bathroom", "bath", SPINE_E + PART, WET + PART, IN_E, LARDER - PART),
  room("r-larder", "Larder", "store", SPINE_E + PART, LARDER + PART, IN_E, DAY - PART),

  /**
   * The living room, with the chimney breast cut out of its south wall.
   *
   * Notched rather than left as a rectangle: the breast projects 290 mm into
   * the room, and a schedule that counts floor the fireplace stands on is
   * quoting a number nobody can use. This is the only room here that is not a
   * rectangle, and it is not one for a reason the drawing will show.
   */
  {
    id: "r-living",
    name: "Living Room",
    use: "living" as const,
    polygon: [
      [IN_W, DAY + PART],
      [-3.6 - 0.05, DAY + PART],
      [-3.6 - 0.05, DAY + 0.35],
      [-2.2 + 0.05, DAY + 0.35],
      [-2.2 + 0.05, DAY + PART],
      [BED_3_W - PART, DAY + PART],
      [BED_3_W - PART, IN_N],
      [IN_W, IN_N],
    ] as [number, number][],
  },

  // The third bedroom takes the north-east corner, off the living room.
  room("r-bed-3", "Bedroom 3", "bed", BED_3_W + PART, DAY + PART, IN_E, IN_N),
];

/* ── the ground between the buildings ──────────────────────────── */

/**
 * How the plot is zoned, south to north, and why that order.
 *
 * A long, narrow plot off a village street organises itself as a **gradient
 * from public to private to productive**, and every traditional courtyard
 * layout in this region is some version of it:
 *
 * | z | zone | what it is for |
 * |---|---|---|
 * | −5 … 0 | street | the road and the boundary wall; nothing of ours |
 * | 0 … 20 | **service yard** | arriving, parking, unloading, the vine walk |
 * | 20 … 32 | **the house** and its porch | living, and the one private outdoor room |
 * | 32 … 44 | **productive garden** | kitchen beds, greenhouse, pond |
 * | 44 … 62 | **orchard** | the long crop, furthest from the gate |
 *
 * The ordering is not arbitrary. The noisy, dirty, wheeled half sits between
 * the street and the house, because that is where it arrives and because it
 * keeps traffic out of the garden. The house sits across the middle of the
 * plot, so it *separates* the public yard from the private garden — you cannot
 * see one from the other, which is the whole point of putting a building
 * across a plot rather than along its edge. The garden gets the north end,
 * where it is screened from the road and reached from the kitchen door, and
 * the orchard takes the far end because it is visited least.
 *
 * The paving below serves that structure: brick where people go, gravel where
 * cars go, and nothing at all in the two zones that are meant to be worked.
 */

/**
 * What people and cars actually stand on.
 *
 * Everything here was lawn, including the route from the gate to the front
 * door and the whole length of the vine walk — so in any weather worth having
 * a pergola for, you crossed mud to reach the house.
 *
 * **Two materials, and the split is by use rather than by taste.** The
 * courtyard, the paths and the aprons are **brick on sand**: Banat yards are
 * traditionally paved with brick and stone *for letting the earth breathe, and
 * not by cement, which brings dampness to the houses* — a permeable-paving
 * argument made long before the phrase existed, and a real constraint for a
 * house with no damp course. The **car track is gravel**, which is cheap,
 * drains, and stays put on a plot this flat (loose stone starts migrating at
 * about 1 in 20; this is 1 in nothing).
 *
 * Widths are the ones the use dictates. A single-car drive is 2.7–3.7 m and
 * this is 3.0; a footpath people pass on is 0.9–1.2 and the garden path is
 * 1.1. A path drawn at road width reads as a road, which is how a garden ends
 * up looking like a car park.
 */
const COURT_W = -0.8; // the vine walk's west edge
const COURT_E = 3.2; // its east edge — the vine is 3.6 m across at x 1.2
const DRIVE_W = 3.0;

/** A rectangle by its two corners, which is how these were measured. */
const between = (x1: number, z1: number, x2: number, z2: number): [number, number][] =>
  rect(Math.min(x1, x2), Math.min(z1, z2), Math.abs(x2 - x1), Math.abs(z2 - z1));

const paving: { id: string; polygon: [number, number][]; material: string }[] = [
  /**
   * The courtyard: the full width of the vine, from the wicket to the door.
   *
   * This is the *curte* — the swept, paved working yard a Banat house is built
   * around, not a garden feature. It runs the whole 18 m of the pergola so
   * there is nowhere under the vine where you step off paving, which was the
   * entire complaint: a covered walk over grass is a covered mud strip.
   */
  { id: "pave-court", polygon: between(COURT_W, 0.6, COURT_E, 20), material: "brick-paving" },

  /**
   * The threshold outside the wicket, through the wall's own thickness.
   *
   * Small, and it earns its place: the boundary wall is 300 mm thick and the
   * ground either side of a gate is where the wear is. Stopping the paving at
   * the wall line leaves a mud step in the one place everyone treads.
   */
  { id: "pave-wicket", polygon: between(WICKET_X - 0.9, -1.2, WICKET_X + 0.9, 0.6), material: "brick-paving" },

  /**
   * The apron at the garage door: 7 m across the door, 5 m deep.
   *
   * Where you stand to open the door, where you unload, and where the car
   * drips. Gravel does none of those well — it migrates under a turning wheel
   * and it comes indoors on your shoes — so the apron is brick where the track
   * that reaches it is not.
   */
  { id: "pave-garage-apron", polygon: between(7.4, 15.0, 14.0, 20.0), material: "brick-paving" },

  /**
   * The footpath linking the two halves of the yard.
   *
   * The car and the person arrive through different gates and never cross, but
   * they do both end up at the house, and someone getting out of the car
   * should not walk back down the drive. 1.1 m: two people cannot pass, and
   * two people do not need to.
   */
  { id: "pave-link", polygon: between(COURT_E, 16.4, 7.4, 17.5), material: "brick-paving" },

  /**
   * Round the west of the house to the porch, and on to the greenhouse.
   *
   * The porch is the house's outdoor room and its door is on the west wall;
   * reaching it meant crossing the lawn. Narrower than the courtyard because
   * this is a garden path — one person, carrying something, in the rain.
   */
  { id: "pave-porch", polygon: between(-10.2, 22.6, -5.5, 31.4), material: "brick-paving" },
  {
    id: "pave-garden-path",
    polygon: between(-8.3, 31.4, -7.2, 36.0),
    material: "brick-paving",
  },
  /** The step out of the greenhouse door, which is at x −7.55 on z = 36. */
  { id: "pave-glass-apron", polygon: between(-8.6, 35.2, -6.5, 36.2), material: "brick-paving" },

  /**
   * The kitchen garden's working path.
   *
   * A bed you cannot reach without standing in it is a bed you do not weed.
   * This is the one surface here that exists for a tool rather than a shoe.
   */
  { id: "pave-kitchen-path", polygon: between(-5.4, 33.6, -4.3, 41.0), material: "brick-paving" },
];

/**
 * Every paved area, so a planting can be told to keep off all of them.
 *
 * Handed to **every** scatter field rather than to the ones that currently
 * overlap, which is the difference between a fix and a rule. `roses-east` runs
 * to x = 4.2 and the courtyard to x = 3.2, so today exactly one field needs it;
 * move a bed or widen a path and the next one would grow through the brick with
 * nothing to say so. Clipping makes this free to over-apply — an exclusion
 * outside the field contributes nothing to the count, and one that straddles
 * the edge is counted only where it overlaps.
 */
const PAVED: [number, number][][] = paving.map((p) => p.polygon);

/** A field's own exclusions, plus every paved surface. */
const keepOff = (...own: [number, number][][]): [number, number][][] => [...PAVED, ...own];

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
    /**
     * Red clay pavers, herringbone.
     *
     * Herringbone is not a decorative choice: interlocking courses set at 45°
     * to the direction of travel distribute a wheel load across their
     * neighbours instead of letting a single paver rock, which is why it is the
     * historic bond for a yard a cart uses and for the apron a car turns on.
     * Red clay because that is what a Banat yard is laid in, and because the
     * house is plastered lime and the roof is clay tile — a grey concrete paver
     * would be the only industrial thing on the plot.
     */
    "brick-paving": {
      label: "Clay Paver, Herringbone",
      source: "ambientcg",
      slug: "PavingStones137",
      baseColor: "#9E6A55",
      textureScale: 2.2,
      roughness: 0.9,
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
        rooms: houseRooms,
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
      // Moved west with the chimney. The grouping is the same — two chairs and
      // a table addressing the breast — because a masonry mass with nothing
      // facing it reads as a pier rather than as a fireplace.
      { id: "chair-hearth-w", asset: "polyhaven/ArmChair_01", position: [-3.95, 0, 29.5], rotationY: 152 },
      { id: "chair-hearth-e", asset: "polyhaven/ArmChair_01", position: [-1.85, 0, 29.5], rotationY: 208 },
      { id: "table-hearth", asset: "polyhaven/CoffeeTable_01", position: [-2.9, 0, 29.1], rotationY: 0 },
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
        exclude: keepOff(),
      },
      {
        id: "roses-east",
        assets: ["polyhaven/shrub_02", "polyhaven/shrub_03", "polyhaven/shrub_04"],
        // Narrower than its western twin, and stopping short of the link path.
        // It is the buffer between the vine walk and the drive rather than a
        // border against open lawn: 1 m of planting is what fits between
        // COURT_E at 3.2 and the drive's western edge at 4.5, and a bed squeezed
        // thinner than that reads as a weed strip.
        area: rect(3.4, 2, 1.0, 14),
        density: 26,
        seed: 12,
        height: 0.9,
        scaleRange: [0.85, 1.2],
        material: "rose-green",
        exclude: keepOff(),
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
        exclude: keepOff(rect(-10.5, 35.4, 6, 7.2) as [number, number][]),
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
        exclude: keepOff(),
      },
    ],

    paving,

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
      /**
       * The drive: carriage gate to garage apron, and nothing else.
       *
       * It used to run up the middle of the plot to the front of the house and
       * throw a spur east — so it crossed the vine walk, and the car's ground
       * and the walker's ground were the same ground. Now it enters through its
       * own gate at x 5.5, holds east of the courtyard the whole way, and ends
       * on the brick apron at the garage door. A person walking from the wicket
       * to the front door never sets foot on it.
       *
       * It stops at z 15 because the apron takes over there: gravel under a
       * turning wheel migrates, and gravel where you stand to unload comes
       * indoors on your shoes.
       */
      {
        id: "drive",
        path: [
          [CARRIAGE_X, -1.5],
          [CARRIAGE_X, 6],
          [7.4, 11],
          [10.5, 15.2],
        ],
        width: DRIVE_W,
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
