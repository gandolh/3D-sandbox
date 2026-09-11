import { describe, expect, it } from "vitest";
import {
  SceneDocument,
  SceneValidationError,
  hasErrors,
  lintScene,
  loadScene,
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
