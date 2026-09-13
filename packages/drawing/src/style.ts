/**
 * The graphic language of an architectural plan.
 *
 * A floor plan is not a picture of a building; it is a **horizontal section**
 * through one, drawn in a convention that is several centuries old and almost
 * entirely about **line weight**. Under ISO 128-2 the weights come from a fixed
 * set — 0.18, 0.25, 0.35, 0.5, 0.7, 1.0 mm — and the rule is a four-step
 * hierarchy with at least 2:1 between the thickest and the thinnest:
 *
 * | weight | what it draws | why |
 * |---|---|---|
 * | 0.70 | what the section **cuts** | the heaviest line is the building itself |
 * | 0.35 | what is **seen** but not cut | sills, thresholds, the things below the cut |
 * | 0.25 | surface and symbol | door leaves, swing arcs, glazing |
 * | 0.18 | hatching, dimensions, notes | supporting information, pushed back |
 *
 * That hierarchy *is* what makes a drawing read as a drawing rather than as an
 * outline. Get it wrong and every line claims equal importance, which is how a
 * CAD export looks like a diagram and a drawn plan looks like a building.
 *
 * Millimetres **on the paper**, not in the world: a 0.7 mm line is 0.7 mm at
 * whatever scale the sheet is printed, which is the whole point of a scale.
 */
export const WEIGHT = {
  /** Cut by the section plane: walls, and anything else the plane passes through. */
  cut: 0.7,
  /** Seen below the cut: sills, steps, the tops of things. */
  seen: 0.35,
  /** Symbols: door leaves, swing arcs, glazing lines. */
  symbol: 0.25,
  /** Hatching, dimension lines, leaders. */
  fine: 0.18,
} as const;

/**
 * Ink, and only ink.
 *
 * A plan is a black-and-white document and stays one. Poché is a grey fill
 * rather than solid black because solid black at this scale swallows the
 * openings cut into it — the convention is a tone dark enough to read as
 * "material" and light enough to keep a 100 mm reveal visible.
 */
export const INK = {
  line: "#111111",
  poche: "#b8b4ad",
  glass: "#7f9bb0",
  label: "#111111",
  faint: "#8a8a8a",
} as const;

/** Where the section is taken, in metres above the floor. */
export const CUT_HEIGHT = 1.2;
