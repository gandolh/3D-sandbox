import { describe, expect, it } from "vitest";
import {
  SceneDocument,
  ScatterField,
  estimateScatterInstances,
  SceneValidationError,
  hasErrors,
  RULES,
  lintScene,
  loadScene,
  resolveEntities,
  type LintFinding,
  type SceneDocumentInput,
} from "../src/index.js";
import { baseScene } from "./fixtures.js";

/** Parse then lint, so rules see a document with defaults applied. */
const lint = (input: SceneDocumentInput, options = {}): LintFinding[] =>
  lintScene(SceneDocument.parse(input), options);

const rules = (findings: readonly LintFinding[]): string[] => findings.map((f) => f.rule);

describe("the fixture itself", () => {
  it("passes every rule", () => {
    expect(lint(baseScene())).toEqual([]);
  });
});

describe("unique-ids", () => {
  it("catches a duplicate id across different entity kinds", () => {
    const doc = baseScene();
    doc.subject!.roofs![0]!.id = "W-01";
    const found = lint(doc);
    expect(rules(found)).toContain("unique-ids");
    expect(found[0]!.message).toMatch(/already used at subject\.levels\[0\]\.walls\[0\]/);
  });
});

describe("unique-ids covers the tiers its comment claims", () => {
  // The brief's acceptance was "a duplicate run id is an error", and what the
  // first pass actually tested was a run colliding with a *wall*. That is a
  // different assertion: it passes on the old rule too, because the wall's id
  // was already claimed. Two runs sharing an id is the case that was broken.
  const twoRuns = (secondId: string): SceneDocumentInput => {
    const doc = baseScene();
    const run = (id: string) => ({
      id,
      kind: "pergola" as const,
      path: [
        [0, 0],
        [8, 0],
      ] as [number, number][],
      width: 2.4,
      height: 2.4,
      spacing: 3,
      material: "wall",
    });
    doc.subject = { ...doc.subject, runs: [run("r-01"), run(secondId)] };
    return doc;
  };

  it("makes two runs sharing an id an error", () => {
    const found = lint(twoRuns("r-01")).filter((f) => f.rule === "unique-ids");
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("error");
    expect(found[0]!.path).toBe("subject.runs[1]");
    // `runs.ts` seeds each pergola's canopy from `run.id`, so two same-id
    // pergolas grew byte-identical foliage — the exact thing that seeding
    // exists to prevent.
    expect(found[0]!.message).toMatch(/already used at subject\.runs\[0\]/);
  });

  it("leaves two differently-named runs alone", () => {
    expect(lint(twoRuns("r-02")).filter((f) => f.rule === "unique-ids")).toEqual([]);
  });

  it("makes two animation tracks sharing an id an error", () => {
    // The other tier the doc comment claimed and the rule did not walk.
    const doc = baseScene();
    doc.animation = {
      duration: 12,
      tracks: [
        {
          id: "t-01",
          target: "solar.minutes",
          keyframes: [
            { at: 0, value: 300 },
            { at: 12, value: 900 },
          ],
        },
        {
          id: "t-01",
          target: "solar.minutes",
          keyframes: [
            { at: 0, value: 900 },
            { at: 12, value: 300 },
          ],
        },
      ],
    } as never;
    const found = lint(doc).filter((f) => f.rule === "unique-ids");
    expect(found).toHaveLength(1);
    expect(found[0]!.path).toBe("animation.tracks[1]");
  });
});

describe("wall-not-degenerate", () => {
  it("rejects a wall with coincident endpoints", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.end = [0, 0];
    expect(rules(lint(doc))).toContain("wall-not-degenerate");
  });

  it("warns when a wall is thicker than it is long", () => {
    const doc = baseScene();
    const wall = doc.subject!.levels![0]!.walls![0]!;
    wall.end = [0.2, 0];
    wall.thickness = 0.24;
    const found = lint(doc).filter((f) => f.rule === "wall-not-degenerate");
    expect(found[0]!.severity).toBe("warning");
  });
});

describe("opening-fits-wall", () => {
  it("rejects an opening that runs past the end of its wall", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 5.5, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    const found = lint(doc).filter((f) => f.rule === "opening-fits-wall");
    expect(found[0]!.message).toMatch(/ends at 6\.900 m but wall "W-01" is only 6\.000 m/);
  });

  it("enforces the 250 mm structural margin at the wall's start", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 0.18, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    const found = lint(doc).filter((f) => f.rule === "opening-fits-wall");
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/180 mm from the start .* below the 250 mm/);
  });

  it("enforces the margin at the wall's end too", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 4.5, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    const found = lint(doc).filter((f) => f.rule === "opening-fits-wall");
    expect(found[0]!.message).toMatch(/100 mm from the end/);
  });

  it("honours a caller-supplied margin", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 0.18, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    expect(lint(doc, { minOpeningEdgeMargin: 0.1 })).toEqual([]);
  });
});

describe("opening-fits-height", () => {
  it("rejects an opening taller than its wall", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 2, width: 1.4, height: 2.2, sill: 0.9 },
    ];
    const found = lint(doc).filter((f) => f.rule === "opening-fits-height");
    expect(found[0]!.message).toMatch(/reaches 3\.100 m but wall "W-01" is only 2\.700 m/);
  });

  it("measures against a wall's own height override, not the level's", () => {
    const doc = baseScene();
    const wall = doc.subject!.levels![0]!.walls![0]!;
    wall.height = 3.6;
    wall.openings = [
      { id: "w-1", kind: "window", offset: 2, width: 1.4, height: 2.2, sill: 0.9 },
    ];
    expect(lint(doc)).toEqual([]);
  });

  it("warns about a door with a sill", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "d-1", kind: "door", offset: 2, width: 1, height: 2.1, sill: 0.3 },
    ];
    const found = lint(doc).filter((f) => f.rule === "opening-fits-height");
    expect(found[0]!.severity).toBe("warning");
  });
});

describe("openings-do-not-overlap", () => {
  it("rejects two openings sharing wall length and height", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 1, width: 1.4, height: 1.2, sill: 0.9 },
      { id: "w-2", kind: "window", offset: 2, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    expect(rules(lint(doc))).toContain("openings-do-not-overlap");
  });

  it("allows a transom stacked directly above a door", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "d-1", kind: "door", offset: 2, width: 1, height: 2.1, sill: 0 },
      { id: "w-1", kind: "window", offset: 2, width: 1, height: 0.4, sill: 2.15 },
    ];
    expect(lint(doc)).toEqual([]);
  });

  it("allows two openings that touch but do not overlap", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 1, width: 1.4, height: 1.2, sill: 0.9 },
      { id: "w-2", kind: "window", offset: 2.4, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    expect(lint(doc)).toEqual([]);
  });
});

describe("roof-covers-walls", () => {
  it("rejects a roof smaller than the walls beneath it", () => {
    const doc = baseScene();
    doc.subject!.roofs![0]!.footprint = [
      [2, 2],
      [4, 2],
      [4, 6],
      [2, 6],
    ];
    const found = lint(doc).filter((f) => f.rule === "roof-covers-walls");
    expect(found[0]!.severity).toBe("error");
    expect(found[0]!.message).toMatch(/does not cover the walls of level "L1"/);
  });

  it("ignores a second building on the same level", () => {
    // The case that broke the old rule: one level, two structures. The house
    // roof must not be judged against the garage's walls twenty metres away.
    const doc = baseScene();
    const level = doc.subject!.levels![0]!;
    level.walls = [
      ...level.walls!,
      { id: "G-01", start: [20, 0], end: [26, 0], material: "m1" },
      { id: "G-02", start: [26, 0], end: [26, 5], material: "m1" },
      { id: "G-03", start: [26, 5], end: [20, 5], material: "m1" },
      { id: "G-04", start: [20, 5], end: [20, 0], material: "m1" },
    ];
    expect(lint(doc).filter((f) => f.rule === "roof-covers-walls")).toEqual([]);
  });

  it("warns about a roof that sits over no walls at all", () => {
    const doc = baseScene();
    doc.subject!.roofs![0]!.footprint = [
      [40, 40],
      [44, 40],
      [44, 44],
      [40, 44],
    ];
    const found = lint(doc).filter((f) => f.rule === "roof-covers-walls");
    expect(found[0]!.severity).toBe("warning");
    expect(found[0]!.message).toMatch(/shelters nothing/);
  });

  it("warns when no level's top matches the roof's eave", () => {
    const doc = baseScene();
    doc.subject!.roofs![0]!.baseElevation = 9;
    const found = lint(doc).filter((f) => f.rule === "roof-covers-walls");
    expect(found[0]!.severity).toBe("warning");
    expect(found[0]!.message).toMatch(/matches no level's top/);
  });

  it("warns when a flat roof carries a pitch", () => {
    const doc = baseScene();
    doc.subject!.roofs![0]!.kind = "flat";
    const found = lint(doc).filter((f) => f.rule === "roof-covers-walls");
    expect(found[0]!.message).toMatch(/flat but has a pitch of 32°/);
  });
});

describe("references", () => {
  it("rejects an unknown material", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.material = "nope";
    const found = lint(doc).filter((f) => f.rule === "material-resolves");
    expect(found[0]!.message).toMatch(/wall "W-01" references material "nope"/);
  });

  it("warns about a material nothing uses", () => {
    const doc = baseScene();
    doc.materials!["spare"] = { label: "Spare", source: "procedural", baseColor: "#FFFFFF" };
    const found = lint(doc).filter((f) => f.rule === "materials-are-used");
    expect(found[0]!.severity).toBe("warning");
  });

  it("skips asset checks when no manifest is supplied", () => {
    const doc = baseScene();
    doc.subject!.placements = [{ id: "p-1", asset: "does/not/exist", position: [0, 0, 0] }];
    expect(lint(doc)).toEqual([]);
  });

  it("rejects an unknown asset once a manifest exists", () => {
    const doc = baseScene();
    doc.subject!.placements = [{ id: "p-1", asset: "does/not/exist", position: [0, 0, 0] }];
    const found = lint(doc, { knownAssets: new Set(["polyhaven/oak_tree_01"]) });
    expect(rules(found)).toContain("asset-resolves");
  });
});

describe("scatter-density-is-sane", () => {
  const withForest = (density: number): SceneDocumentInput => {
    const doc = baseScene();
    doc.context = {
      scatter: [
        {
          id: "forest",
          assets: ["polyhaven/oak_tree_01"],
          area: [
            [-50, -50],
            [50, -50],
            [50, 50],
            [-50, 50],
          ],
          density,
        },
      ],
    };
    return doc;
  };

  it("accepts a forest inside the budget", () => {
    expect(lint(withForest(2))).toEqual([]);
  });

  it("warns when instances would break the path tracer's BVH build", () => {
    const found = lint(withForest(60)).filter((f) => f.rule === "scatter-density-is-sane");
    expect(found[0]!.severity).toBe("warning");
    expect(found[0]!.message).toMatch(/6,000 instances/);
  });

  it("subtracts excluded regions from the instance estimate", () => {
    const doc = withForest(60);
    doc.context!.scatter![0]!.exclude = [
      [
        [-50, -50],
        [50, -50],
        [50, 45],
        [-50, 45],
      ],
    ];
    expect(lint(doc)).toEqual([]);
  });
});

describe("loadScene", () => {
  it("throws on an error finding and names every one", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.material = "nope";
    expect(() => loadScene(doc)).toThrow(SceneValidationError);
    try {
      loadScene(doc);
    } catch (error) {
      expect((error as SceneValidationError).findings.length).toBeGreaterThan(0);
      expect((error as Error).message).toMatch(/Scene "fixture" has \d+ error/);
    }
  });

  it("returns warnings without throwing", () => {
    const doc = baseScene();
    doc.materials!["spare"] = { label: "Spare", source: "procedural", baseColor: "#FFFFFF" };
    const { findings } = loadScene(doc);
    expect(hasErrors(findings)).toBe(false);
    expect(findings).toHaveLength(1);
  });
});

describe("entity resolution", () => {
  it("names the chain of ids enclosing a finding, outermost first", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 0.1, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    const found = lint(doc).filter((f) => f.rule === "opening-fits-wall");
    expect(found[0]!.entities).toEqual(["L1", "W-01", "w-1"]);
  });

  it("lets a wall claim findings raised against its openings", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 0.1, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    const forWall = lint(doc).filter((f) => f.entities.includes("W-01"));
    expect(forWall.length).toBeGreaterThan(0);
  });

  it("resolves a roof to its own id", () => {
    const doc = baseScene();
    doc.subject!.roofs![0]!.baseElevation = 9;
    const found = lint(doc).filter((f) => f.rule === "roof-covers-walls");
    expect(found[0]!.entities).toEqual(["R-01"]);
  });

  it("survives a path that points at nothing", () => {
    const doc = SceneDocument.parse(baseScene());
    expect(resolveEntities(doc, "subject.levels[99].walls[4]")).toEqual([]);
  });

  it("does not repeat an id that appears twice in the chain", () => {
    const doc = SceneDocument.parse(baseScene());
    expect(resolveEntities(doc, "subject.levels[0]")).toEqual(["L1"]);
  });
});

describe("loadScene presents one error type", () => {
  // A route handler should not have to know Zod exists. Shape failures and
  // semantic failures both arrive as SceneValidationError with findings.
  it("wraps a shape failure as findings, not a ZodError", () => {
    expect(() => loadScene({ hello: 1 })).toThrow(SceneValidationError);
    try {
      loadScene({ hello: 1 });
    } catch (error) {
      const findings = (error as SceneValidationError).findings;
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.every((f) => f.rule === "schema")).toBe(true);
      expect(findings.every((f) => f.severity === "error")).toBe(true);
    }
  });

  it("names the offending path", () => {
    const doc = baseScene();
    doc.site.latitude = 200;
    try {
      loadScene(doc);
    } catch (error) {
      const findings = (error as SceneValidationError).findings;
      expect(findings.some((f) => f.path.includes("latitude"))).toBe(true);
    }
  });

  it("reports a root-level failure as <root>", () => {
    try {
      loadScene("not an object");
    } catch (error) {
      expect((error as SceneValidationError).findings[0]!.path).toBe("<root>");
    }
  });
});

describe("estimateScatterInstances", () => {
  const field = (density: number, exclude: number[][][] = []) =>
    ScatterField.parse({
      id: "f",
      assets: ["a"],
      area: [[-50, -50], [50, -50], [50, 50], [-50, 50]],
      density,
      exclude,
    });

  it("is net area over 100, times density", () => {
    const { net, instances } = estimateScatterInstances(field(2));
    expect(net).toBeCloseTo(10_000);
    expect(instances).toBe(200);
  });

  it("subtracts exclusions", () => {
    const clearing = [[[-20, -20], [20, -20], [20, 20], [-20, 20]]];
    const { net, instances } = estimateScatterInstances(field(2, clearing));
    expect(net).toBeCloseTo(8_400);
    expect(instances).toBe(168);
  });

  it("matches the reference scene's 284 trees", () => {
    // The lint budget and the API's scene summary both read this number. If they
    // ever disagree, one of them is describing a different scene.
    const forest = ScatterField.parse({
      id: "forest",
      assets: ["a"],
      area: [[-60, -60], [60, -60], [60, 60], [-60, 60]],
      density: 2.1,
      exclude: [[[-14, -16], [14, -16], [14, 16], [-14, 16]]],
    });
    expect(estimateScatterInstances(forest).instances).toBe(284);
  });
});

describe("roof-covers-walls, the overhang direction", () => {
  // Handed over from brief 42, which settled what `overhang` means: *the least
  // the declared footprint oversails the walls beneath it, on any one side*.
  // The rule passed `+overhang` to `boundsContain` as a tolerance, which
  // loosens containment — it permitted a roof **smaller** than its walls by
  // exactly the amount it is declared to oversail them by.
  const roofOver = (inset: number): LintFinding[] => {
    const doc = baseScene();
    // Walls span x 0…6, z 0…8. `inset` grows the footprint past them.
    doc.subject!.roofs![0]!.footprint = [
      [-inset, -inset],
      [6 + inset, -inset],
      [6 + inset, 8 + inset],
      [-inset, 8 + inset],
    ];
    doc.subject!.roofs![0]!.overhang = 0.4;
    return lint(doc).filter((f) => f.rule === "roof-covers-walls");
  };

  it("accepts a roof that oversails by its declared overhang", () => {
    expect(roofOver(0.4)).toEqual([]);
    expect(roofOver(0.6)).toEqual([]);
  });

  it("rejects a roof that only just covers the walls", () => {
    // Flush is the case the old tolerance permitted: the roof reaches the
    // walls exactly while declaring a 0.4 m eave. Elmsgate shipped like this.
    const found = roofOver(0);
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("error");
    expect(found[0]!.message).toMatch(/by its declared 0\.4 m overhang/);
  });

  it("rejects a roof that falls short of its declared eave", () => {
    expect(roofOver(0.2)).toHaveLength(1);
  });

  it("does not fail a footprint that misses by float noise", () => {
    // `rect(7 - 0.4, …)` produces 14.399999999999999, so a roof declaring
    // exactly the eave it draws misses an exact `>=` by 2e-15 m. Both of
    // Greenhollow's outbuildings did, the moment this comparison started
    // pointing the right way.
    const doc = baseScene();
    doc.subject!.roofs![0]!.footprint = [
      [0 - 0.4, 0 - 0.4],
      [6 + 0.4 - Number.EPSILON * 8, -0.4],
      [6 + 0.4 - Number.EPSILON * 8, 8 + 0.4],
      [-0.4, 8 + 0.4],
    ];
    doc.subject!.roofs![0]!.overhang = 0.4;
    expect(lint(doc).filter((f) => f.rule === "roof-covers-walls")).toEqual([]);
  });
});

/* ── the rules that were registered but never proved to fire ──────── */

const withRun = (over: Record<string, unknown>): SceneDocumentInput => {
  const doc = baseScene();
  doc.subject = {
    ...doc.subject,
    runs: [
      {
        id: "r-01",
        kind: "pergola",
        path: [
          [0, 0],
          [8, 0],
        ],
        width: 2.4,
        height: 2.4,
        spacing: 3,
        material: "wall",
        ...over,
      } as never,
    ],
  };
  return doc;
};

const runFindings = (over: Record<string, unknown>) =>
  lint(withRun(over)).filter((f) => f.rule === "run-is-well-formed");

describe("run-is-well-formed", () => {
  // Five checks, one test each. One of them — the `kind !== "fence"` guard —
  // was edited two days before this brief was written with nothing asserting
  // that any of the five still worked.

  it("rejects a repeated point", () => {
    const found = runFindings({
      path: [
        [0, 0],
        [0, 0],
        [8, 0],
      ],
    });
    expect(found.map((f) => f.severity)).toContain("error");
    expect(found[0]!.message).toMatch(/repeats the same point/);
  });

  it("warns when a run is narrower than its own two rows of posts", () => {
    const found = runFindings({ width: 0.1 });
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("warning");
    expect(found[0]!.message).toMatch(/narrower than its own posts/);
  });

  it("does not fire that check on a fence, which stands on one row", () => {
    // The guard added by brief 21. A fence's `width` is the thickness of the
    // thing, so a small number is correct, and this rule used to call every
    // railing a mistake.
    expect(runFindings({ kind: "fence", width: 0.1 })).toHaveLength(0);
    expect(runFindings({ kind: "hedge", width: 0.1 })).toHaveLength(0);
  });

  it("warns when the post spacing exceeds the whole path", () => {
    const found = runFindings({ spacing: 40 });
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("warning");
    expect(found[0]!.message).toMatch(/posts only at its ends/);
  });

  it("warns about a pergola you cannot walk under", () => {
    const found = runFindings({ height: 1.6 });
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("warning");
    expect(found[0]!.message).toMatch(/cannot walk under/);
  });

  it("warns about a climber on something that cannot carry one", () => {
    const found = runFindings({ kind: "fence", climber: "wall" });
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("warning");
    expect(found[0]!.message).toMatch(/only a pergola carries one/);
  });
});

describe("polygons-have-area", () => {
  it("catches a slab polygon with three collinear points", () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.slabs = [
      {
        id: "slab-flat",
        polygon: [
          [0, 0],
          [4, 0],
          [8, 0],
        ],
        thickness: 0.2,
        material: "wall",
      },
    ];
    expect(rules(lint(doc))).toContain("polygons-have-area");
  });
});

describe("shot-camera-is-valid", () => {
  it("catches a camera looking at its own position", () => {
    const doc = baseScene();
    doc.shots = [
      {
        id: "s-01",
        name: "Nowhere",
        camera: { position: [3, 2, 3], target: [3, 2, 3], focalLength: 35 },
      },
    ];
    expect(rules(lint(doc))).toContain("shot-camera-is-valid");
  });
});

/* ── the guard that stops a fourteenth unarmed rule ───────────────── */

/**
 * One document per rule that trips it.
 *
 * This map is the mechanism, not the tests above. `asset-resolves` was
 * registered in `RULES` and never actually armed, and **eight invented Poly
 * Haven slugs shipped** in Greenhollow as a result. The fixture tests prove a
 * good document stays quiet, which is not the same thing — a rule that can
 * never fire also stays quiet.
 *
 * Adding a rule to `RULES` without adding a key here fails the suite, which is
 * the actual failure mode being closed.
 */
const FIRES: Record<string, () => LintFinding[]> = {
  "unique-ids": () => lint(withRun({ id: "W-01" })),
  "wall-not-degenerate": () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.end = [0, 0];
    return lint(doc);
  },
  "opening-fits-wall": () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 5.5, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    return lint(doc);
  },
  "opening-fits-height": () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 1, width: 1.4, height: 2.4, sill: 0.9 },
    ];
    return lint(doc);
  },
  "openings-do-not-overlap": () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.openings = [
      { id: "w-1", kind: "window", offset: 1, width: 1.4, height: 1.2, sill: 0.9 },
      { id: "w-2", kind: "window", offset: 1.8, width: 1.4, height: 1.2, sill: 0.9 },
    ];
    return lint(doc);
  },
  "roof-covers-walls": () => {
    const doc = baseScene();
    doc.subject!.roofs![0]!.footprint = [
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
    ];
    return lint(doc);
  },
  "run-is-well-formed": () => lint(withRun({ height: 1.6 })),
  "polygons-have-area": () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.slabs = [
      {
        id: "slab-flat",
        polygon: [
          [0, 0],
          [4, 0],
          [8, 0],
        ],
        thickness: 0.2,
        material: "wall",
      },
    ];
    return lint(doc);
  },
  "material-resolves": () => {
    const doc = baseScene();
    doc.subject!.levels![0]!.walls![0]!.material = "no-such-material";
    return lint(doc);
  },
  "asset-resolves": () => {
    const doc = baseScene();
    doc.subject = {
      ...doc.subject,
      placements: [
        { id: "p-01", asset: "polyhaven/not_a_real_slug", position: [1, 0, 1], rotationY: 0 },
      ],
    };
    return lint(doc, { knownAssets: new Set(["polyhaven/ArmChair_01"]) });
  },
  "scatter-density-is-sane": () => {
    const doc = baseScene();
    doc.context = {
      ...doc.context,
      scatter: [
        {
          id: "forest",
          assets: ["polyhaven/tree_small_02"],
          area: [
            [0, 0],
            [0, 100],
            [100, 100],
            [100, 0],
          ],
          density: 60,
        } as never,
      ],
    };
    return lint(doc);
  },
  "shot-camera-is-valid": () => {
    const doc = baseScene();
    doc.shots = [
      {
        id: "s-01",
        name: "Nowhere",
        camera: { position: [3, 2, 3], target: [3, 2, 3], focalLength: 35 },
      },
    ];
    return lint(doc);
  },
  "materials-are-used": () => {
    const doc = baseScene();
    doc.materials = {
      ...doc.materials,
      spare: { label: "Spare", source: "procedural", baseColor: "#123456" },
    };
    return lint(doc);
  },
};

describe("every registered rule is armed", () => {
  it.each(RULES.map((r) => r.name))("%s has a document that trips it", (name) => {
    const build = FIRES[name];
    // The message a future author needs, at the moment they need it.
    expect(build, `no firing document for "${name}" — add one to FIRES`).toBeDefined();
    expect(rules(build!())).toContain(name);
  });

  it("has no firing document for a rule that no longer exists", () => {
    // The other direction: a deleted rule leaving dead scaffolding behind is
    // how a list stops describing the thing it lists.
    const registered = new Set(RULES.map((r) => r.name));
    expect(Object.keys(FIRES).filter((name) => !registered.has(name))).toEqual([]);
  });
});
